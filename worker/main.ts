import {setTimeout as sleep} from 'node:timers/promises';
import {readdir,stat,unlink} from 'node:fs/promises';
import {db} from '../lib/server/admin';
import {claimJob,finishJob,heartbeat,reserveSearch,saveObservation} from '../lib/server/queue';
import {mondayAfter,routeSchema, type Observation} from '../lib/domain';
import {Collector,Blocked} from './collector';
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
const poll=Math.max(60000,Number(process.env.WORKER_POLL_MS)||300000);
const delay=Math.max(5000,Number(process.env.SEARCH_DELAY_MS)||15000);
const artifacts=process.env.ARTIFACT_DIR??'worker/artifacts';
async function prune(){for(const file of await readdir(artifacts).catch(()=>[])){if(!/^[A-Z]{3}_\d{4}-\d{2}-\d{2}_\d+\.png$/.test(file))continue;const path=`${artifacts}/${file}`;if(Date.now()-(await stat(path)).mtimeMs>7*86400000)await unlink(path);}}
async function main(){
 if(process.env.PILOT_APPROVED!=='true')throw new Error('Run worker:pilot on this host and inspect evidence before setting PILOT_APPROVED=true');
 await prune();let ticks=0;
 while(!stopping){
  const job=await claimJob();if(!job){if(++ticks%288===0)await prune();await sleep(poll);continue;}
  const collector=new Collector();let cancelled=false,lost=false;
  const beat=setInterval(()=>{void heartbeat(job).then(c=>{cancelled=c;}).catch(()=>{lost=true;void collector.close();});},30000);
  try{
   if(job.cursor>=job.dates.length){await finishJob(job,'completed','All itinerary checks finished');continue;}
   await collector.start();const route=routeSchema.parse((await db().doc(`destinations/${job.destination}`).get()).data());
   while(job.cursor<job.dates.length){
    cancelled=await heartbeat(job);
    if(cancelled){await finishJob(job,'cancelled','Cancelled between searches');break;}
    if(stopping){await finishJob(job,'queued','Worker stopped; saved progress retained');break;}
    if(lost)throw new Error('Worker lease lost');
    if(!await reserveSearch(job)){await finishJob(job,'queued','Daily search limit reached; waiting for next Manila day');await sleep(poll);break;}
    const date=job.dates[job.cursor];let result:Observation;
    try{result=await collector.collect(route,date);}catch(e){
     if(e instanceof Blocked){await finishJob(job,'paused',e.message);break;}
     // Retry the current itinerary once; each attempt reserves daily budget.
     if(!await reserveSearch(job)){await finishJob(job,'queued','Daily limit reached before retry');break;}
     await sleep(delay);
     try{result=await collector.collect(route,date);}catch(retry){
      if(retry instanceof Blocked){await finishJob(job,'paused',retry.message);break;}
      result={destination:route.code,departure:date,returnDate:mondayAfter(date),checkedAt:new Date().toISOString(),status:'failed',quote:null,indicativeBaseFare:null,note:String(retry instanceof Error?retry.message:'Collection failed').slice(0,1000),evidence:'Browser collector failed; no price asserted'};
     }
    }
    await saveObservation(result,job);job.cursor++;job.failures=result.status==='failed'?job.failures+1:0;
    if(job.failures>=3){await finishJob(job,'paused','Three consecutive parsing/search failures; inspect airline UI before resuming');break;}
    if(job.cursor===job.dates.length){await finishJob(job,'completed','All itinerary checks finished; see individual coverage statuses');break;}
    await sleep(delay);
   }
  }catch(e){console.error('Worker job failed:',e instanceof Error?e.message:'Unknown error');if(!lost)await finishJob(job,'paused','Worker error; inspect server logs before resuming').catch(()=>{});}
  finally{clearInterval(beat);await collector.close();}
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
