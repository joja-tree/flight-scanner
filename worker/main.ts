import {setTimeout as sleep} from 'node:timers/promises';
import {readdir,stat,unlink} from 'node:fs/promises';
import {db} from '../lib/server/admin';
import {claimJob,finishJob,heartbeat,reserveSearch,reuseFresh,saveObservation} from '../lib/server/queue';
import {nextItinerary,routeSchema,type Observation} from '../lib/domain';
import {Collector,Blocked} from './collector';
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
const delay=Math.max(15000,Number(process.env.SEARCH_DELAY_MS)||15000);
async function prune(){const dir=process.env.ARTIFACT_DIR??'worker/artifacts';for(const file of await readdir(dir).catch(()=>[])){if(!/^(?:failure_)?[A-Z]{3}_\d{4}-\d{2}-\d{2}_\d+\.(png|json)$/.test(file))continue;const path=`${dir}/${file}`;if(Date.now()-(await stat(path)).mtimeMs>7*86400000)await unlink(path);}}
async function main(){
 const id=process.argv[2];if(!id)throw new Error('Usage: node --env-file=worker/.env --import tsx worker/main.ts search_BATCH_ID');
 if(process.env.PILOT_APPROVED!=='true')throw new Error('Validate the actual-host pilot before setting PILOT_APPROVED=true');
 await prune();
 const job=await claimJob(id);if(!job){console.log('Batch is not claimable: completed, paused, daily limit reached, or another worker holds the lease. No browser opened.');return;}
 const collector=new Collector();let started=false,lost=false;
 const beat=setInterval(()=>{void heartbeat(job).catch(()=>{lost=true;});},30000);
 try{
  while(true){
   if(lost)throw new Error('Worker lease lost');
   const cancelled=await heartbeat(job);
   if(cancelled||stopping){await finishJob(job,cancelled?'cancelled':'queued','Stopped between searches; saved results retained');break;}
   const item=nextItinerary(job);
   if(!item){await finishJob(job,'completed','Finished included combinations; inspect individual statuses');break;}
   if(await reuseFresh(job,item)){console.log('Reused',item.id);continue;}
   if(!await reserveSearch(job)){await finishJob(job,'queued','Daily limit reached or cancellation requested; resume later');break;}
   if(!started){await collector.start();started=true;}
   const route=routeSchema.parse((await db().doc(`destinations/${item.destination}`).get()).data());
   let result:Observation;
   try{result=await collector.collect(route,item.departure,item.returnDate);}catch(error){
    if(error instanceof Blocked){await finishJob(job,'paused',error.message);break;}
    await sleep(delay);
    if(stopping||await heartbeat(job)){await finishJob(job,job.cancelRequested?'cancelled':'queued','Stopped before retry');break;}
    if(job.excluded.includes(item.destination))continue;
    if(!await reserveSearch(job)){await finishJob(job,'queued','Daily limit reached before retry');break;}
    try{result=await collector.collect(route,item.departure,item.returnDate);}catch(retry){
     if(retry instanceof Blocked){await finishJob(job,'paused',retry.message);break;}
     result={destination:item.destination,departure:item.departure,returnDate:item.returnDate,checkedAt:new Date().toISOString(),status:'failed',quote:null,indicativeBaseFare:null,note:String(retry instanceof Error?retry.message:'Collection failed').slice(0,1000),evidence:'Browser search failed; no fare asserted'};
    }
   }
   await saveObservation(result,job);console.log(result.status,item.id,`${job.done.length} saved`);
   if(job.failures>=3){await finishJob(job,'paused','Three consecutive failures; inspect airline before resuming');break;}
   if(nextItinerary(job))await sleep(delay);
  }
 }catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=1;if(!lost)await finishJob(job,'paused','Worker error; inspect local logs').catch(()=>{});}
 finally{clearInterval(beat);await collector.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
