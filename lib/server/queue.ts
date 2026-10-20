import {randomUUID,createHash} from 'node:crypto';
import {db} from './admin';
import {itineraryId,mergeObservation,nextItinerary,observationSchema,refreshSchema,stale,type RefreshRequest,type Job,type Observation,type FareRecord} from '../domain';
import {authorizeRefresh,canClaim,dailyKey,HttpError,limits} from './policy';
export const LEASE_MS=180000;
export const jobIdSchemaPattern=/^search_[a-f0-9]{32}$/;
export async function enqueue(raw:RefreshRequest,user:{uid:string;owner:boolean}){
 authorizeRefresh(user.owner,'search',false);
 const input=refreshSchema.parse(raw),d=db();
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 if(input.pairs.some(p=>p.departure<today))throw new HttpError(400,'Choose future departure dates');
 const id='search_'+createHash('sha256').update(JSON.stringify([user.uid,input.pairs,input.destinations])).digest('hex').slice(0,32);
 return d.runTransaction(async tx=>{
  const ref=d.doc(`jobs/${id}`),lock=d.doc('system/queue');
  const [existing,state,...routes]=await tx.getAll(ref,lock,...input.destinations.map(c=>d.doc(`destinations/${c}`)));
  if(routes.some(r=>!r.exists))throw new HttpError(400,'Unknown destination');
  const previous=existing.data() as Job|undefined;
  if(previous&&['queued','running','paused'].includes(previous.status))return {created:[],reused:[id],id};
  const pending=state.data()?.pending??0;
  if(pending>=limits().pending)throw new HttpError(429,'The scan queue is full');
  const now=Date.now();
  const job:Job={id,kind:'search',uid:user.uid,pairs:input.pairs,destinations:input.destinations,excluded:[],done:[],force:input.force,status:'queued',createdAt:now,updatedAt:now,leaseUntil:0,leaseToken:null,cancelRequested:false,message:state.data()?.paused?'Saved; collection is paused until the blocker is resolved':'Ready for the local batch runner',failures:0};
  tx.set(ref,job);tx.set(lock,{pending:pending+1},{merge:true});return {created:[id],reused:[],id};
 });
}
export async function claimJob(id:string):Promise<Job|null>{
 if(!jobIdSchemaPattern.test(id))throw new Error('Specify a search batch ID');
 const d=db();return d.runTransaction(async tx=>{
  const lock=d.doc('system/queue'),ref=d.doc(`jobs/${id}`);
  const [state,doc,usage]=await tx.getAll(lock,ref,d.doc(`usage/${dailyKey()}`));
  const now=Date.now(),j=doc.data() as Job|undefined;
  if(!j||j.kind!=='search'||state.data()?.paused||(state.data()?.leaseUntil??0)>now||!canClaim(j,now)||(usage.data()?.searches??0)>=limits().daily)return null;
  const token=randomUUID(),claimed={...j,status:'running' as const,leaseToken:token,leaseUntil:now+LEASE_MS,updatedAt:now};
  tx.update(ref,claimed);tx.set(lock,{activeJob:id,leaseToken:token,leaseUntil:now+LEASE_MS},{merge:true});return claimed;
 });
}
export async function heartbeat(job:Job){const d=db();return d.runTransaction(async tx=>{
 const ref=d.doc(`jobs/${job.id}`),lock=d.doc('system/queue');const [a,b]=await tx.getAll(ref,lock);
 if(a.data()?.leaseToken!==job.leaseToken||b.data()?.leaseToken!==job.leaseToken||a.data()?.status!=='running')throw new Error('Worker lease lost');
 const live=a.data() as Job;job.excluded=live.excluded;job.cancelRequested=live.cancelRequested;
 const expiry=Date.now()+LEASE_MS;tx.update(ref,{leaseUntil:expiry});tx.update(lock,{leaseUntil:expiry});return live.cancelRequested;
});}
export async function reserveSearch(job:Job){const d=db();return d.runTransaction(async tx=>{
 const ref=d.doc(`usage/${dailyKey()}`);const [usage,doc,lock]=await tx.getAll(ref,d.doc(`jobs/${job.id}`),d.doc('system/queue'));
 if(doc.data()?.leaseToken!==job.leaseToken||lock.data()?.leaseToken!==job.leaseToken||doc.data()?.status!=='running')throw new Error('Worker lease lost');
 if(doc.data()?.cancelRequested)return false;
 const used=usage.data()?.searches??0;if(used>=limits().daily)return false;
 tx.set(ref,{searches:used+1,day:dailyKey()});return true;
});}
export async function finishJob(job:Job,status:Job['status'],message:string){const d=db();await d.runTransaction(async tx=>{
 const ref=d.doc(`jobs/${job.id}`),lock=d.doc('system/queue');const [a,b]=await tx.getAll(ref,lock);
 if(a.data()?.leaseToken!==job.leaseToken||b.data()?.leaseToken!==job.leaseToken||a.data()?.status!=='running')throw new Error('Worker lease lost');
 const live=a.data() as Job;
 // Undo may have added work since the runner's last heartbeat.
 const reopened=status==='completed'&&!!nextItinerary(live);
 const finalStatus=reopened?'queued':status;
 const terminal=['completed','cancelled'].includes(finalStatus);
 tx.update(ref,{status:finalStatus,message:reopened?'Destinations restored; resume this batch':message,leaseUntil:0,leaseToken:null,updatedAt:Date.now()});
 tx.set(lock,{leaseUntil:0,leaseToken:null,activeJob:null,pending:Math.max(0,(b.data()?.pending??1)-(terminal?1:0)),...(status==='paused'?{paused:true,blocker:message}:{})},{merge:true});
 });}
export async function readFare(destination:string,departure:string,returnDate:string){
 const d=db(),id=itineraryId(destination,departure,returnDate);
 const [current,legacy]=await d.getAll(d.doc(`fares/${id}`),d.doc(`fares/${destination}_${departure}`));
 let result=current.data() as FareRecord|undefined;const old=legacy.data() as FareRecord|undefined;
 if(old?.returnDate===returnDate){if(old.lastVerified)result=mergeObservation(result,old.lastVerified);result=mergeObservation(result,old.latest);}
 return result;
}
export async function reuseFresh(job:Job,item:{id:string;destination:string;departure:string;returnDate:string}){
 if(job.force)return false;
 const fare=await readFare(item.destination,item.departure,item.returnDate);
 if(!fare?.lastVerified||stale(fare.lastVerified)||fare.latest.status!=='verified')return false;
 await markDone(job,item.id);return true;
}
async function markDone(job:Job,id:string){const d=db();await d.runTransaction(async tx=>{
 const ref=d.doc(`jobs/${job.id}`);const [doc,lock]=await tx.getAll(ref,d.doc('system/queue'));const live=doc.data() as Job;
 if(live.leaseToken!==job.leaseToken||lock.data()?.leaseToken!==job.leaseToken||live.status!=='running')throw new Error('Worker lease lost');
 tx.update(ref,{done:[...new Set([...live.done,id])],updatedAt:Date.now(),message:'Reused a verified observation under 24 hours old'});
 });job.done=[...new Set([...job.done,id])];}
export async function saveObservation(raw:Observation,job?:Job){
 const o=observationSchema.parse(raw),d=db(),id=itineraryId(o.destination,o.departure,o.returnDate);
 if(job&&(!job.destinations.includes(o.destination)||!job.pairs.some(p=>p.departure===o.departure&&p.returnDate===o.returnDate)))throw new Error('Worker itinerary does not match batch');
 const historyId=createHash('sha256').update(id+o.checkedAt).digest('hex');
 await d.runTransaction(async tx=>{
  const ref=d.doc(`fares/${id}`),route=d.doc(`destinations/${o.destination}`),legacy=d.doc(`fares/${o.destination}_${o.departure}`);
  const reads=await tx.getAll(ref,route,legacy,...(job?[d.doc(`jobs/${job.id}`),d.doc('system/queue')]:[]));
  const live=job?reads[3].data() as Job:undefined;
  if(job&&(live?.leaseToken!==job.leaseToken||reads[4].data()?.leaseToken!==job.leaseToken||live?.status!=='running'||live.done.includes(id)))throw new Error('Worker lease or progress lost');
  let previous=reads[0].data() as FareRecord|undefined;const old=reads[2].data() as FareRecord|undefined;
  if(old?.returnDate===o.returnDate){if(old.lastVerified)previous=mergeObservation(previous,old.lastVerified);previous=mergeObservation(previous,old.latest);tx.delete(legacy);}
  tx.set(ref,mergeObservation(previous,o));tx.set(d.doc(`observations/${historyId}`),o);
  if(o.status==='verified'&&reads[1].exists)tx.update(route,{directStatus:'verified',verifiedAt:o.checkedAt});
  if(job&&live)tx.update(d.doc(`jobs/${job.id}`),{done:[...live.done,id],updatedAt:Date.now(),message:`Saved ${live.done.length+1} itinerary results`,failures:o.status==='failed'?live.failures+1:0});
 });
 if(job){job.done=[...job.done,id];job.failures=o.status==='failed'?job.failures+1:0;}
}
export async function cancelJob(id:string,user:{uid:string;owner:boolean}){const d=db();await d.runTransaction(async tx=>{
 const ref=d.doc(`jobs/${id}`),control=d.doc('system/queue');const [doc,state]=await tx.getAll(ref,control);
 if(!doc.exists)throw new HttpError(404,'Job not found');const j=doc.data() as Job;
 if(!user.owner&&j.uid!==user.uid)throw new HttpError(403,'You cannot cancel this scan');
 if(['completed','cancelled'].includes(j.status))return;
 if(j.status==='running')tx.update(ref,{cancelRequested:true});else{tx.update(ref,{status:'cancelled',updatedAt:Date.now(),message:'Cancelled'});tx.set(control,{pending:Math.max(0,(state.data()?.pending??1)-1)},{merge:true});}
});}
export async function setExclusions(id:string,excluded:string[],user:{uid:string;owner:boolean}){if(!user.owner)throw new HttpError(403,'Owner access required');const d=db();await d.runTransaction(async tx=>{
 const ref=d.doc(`jobs/${id}`),control=d.doc('system/queue');const [doc,state]=await tx.getAll(ref,control);const j=doc.data() as Job|undefined;
 if(!j||j.kind!=='search'||j.uid!==user.uid)throw new HttpError(404,'Search not found');
 if(excluded.some(c=>!j.destinations.includes(c)))throw new HttpError(400,'Destination is outside this search');
 const updated={...j,excluded:[...new Set(excluded)]};const reopen=j.status==='completed'&&!!nextItinerary(updated);
 if(reopen&&(state.data()?.pending??0)>=limits().pending)throw new HttpError(429,'Queue full; retry Undo later');
 tx.update(ref,{excluded:updated.excluded,updatedAt:Date.now(),...(reopen?{status:'queued',message:'Destinations restored; resume this batch'}:{})});
 if(reopen)tx.set(control,{pending:(state.data()?.pending??0)+1},{merge:true});
});}
export async function resumeCollection(){const d=db();await d.runTransaction(async tx=>{const state=d.doc('system/queue');const paused=await tx.get(d.collection('jobs').where('status','==','paused').limit(200));for(const doc of paused.docs)if(doc.data().kind==='search')tx.update(doc.ref,{status:'queued',message:'Resumed by owner',failures:0,updatedAt:Date.now()});tx.set(state,{paused:false,blocker:null},{merge:true});});}
