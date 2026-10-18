import { randomUUID, createHash } from 'node:crypto';
import { db } from './admin';
import { departures, jobKey, itineraryId, mergeObservation, type RefreshRequest, type Destination, type Job, type Observation, type FareRecord } from '../domain';
import { authorizeRefresh, canClaim, dailyKey, HttpError, limits } from './policy';
export const LEASE_MS=180000;
const active=(j:Job|undefined)=>j&&['queued','running','paused'].includes(j.status);
export async function enqueue(input:RefreshRequest,user:{uid:string;owner:boolean}){
 const l=limits();authorizeRefresh(user.owner,input.scope,l.publicRefresh);
 const d=db();const routesSnap=input.scope==='year'?await d.collection('destinations').limit(100).get():null;
 const codes=input.scope==='year'?routesSnap!.docs.map(x=>x.id):[input.destination];
 if(!codes.length)throw new HttpError(409,'Discover or import destinations before starting a scan');
 return d.runTransaction(async tx=>{
  const now=Date.now();const control=d.doc('system/queue');const usage=d.doc(`users/${user.uid}`);
  const refs=codes.flatMap(code=>Array.from({length:13},(_,m)=>d.doc(`jobs/${jobKey(code,m)}`)));
  const [state,person,...existing]=await tx.getAll(control,usage,...refs);
  const routeDocs=await tx.getAll(...codes.map(code=>d.doc(`destinations/${code}`)));
  if(routeDocs.some(x=>!x.exists))throw new HttpError(400,'Unknown destination');
  if(state.data()?.paused)throw new HttpError(409,'Collection is paused; the owner must resolve the worker blocker');
  const jobs:Job[]=[];const reused:string[]=[];
  for(let i=0;i<codes.length;i++){
   const group=existing.slice(i*13,(i+1)*13).map(x=>x.data() as Job|undefined);
   const month=input.scope==='year'?0:input.month;
   const blockers=month===0?[group[0]].filter(active):[group[0],group[month]].filter(active);
   if(blockers.length){reused.push(...blockers.map(j=>j!.id));continue;}
   const overlapping=month===0?group.slice(1).filter(active):[];
   reused.push(...overlapping.map(j=>j!.id));
   const dates=departures(month||undefined).filter(date=>!overlapping.some(j=>j!.dates.includes(date)));
   if(!dates.length)continue;
   jobs.push({id:jobKey(codes[i],month),uid:user.uid,destination:codes[i],month,dates,cursor:0,status:'queued',createdAt:now,updatedAt:now,leaseUntil:0,leaseToken:null,cancelRequested:false,message:'Waiting for worker',failures:0});
  }
  if(!jobs.length)return {created:[],reused};
  if(!user.owner&&now-(person.data()?.lastRefreshAt??0)<l.cooldownMs)throw new HttpError(429,'Please wait before requesting another refresh');
  const pending=state.data()?.pending??0;
  if(pending+jobs.length>l.pending)throw new HttpError(429,'The scan queue is full. Retry after existing jobs finish.');
  for(const job of jobs)tx.set(d.doc(`jobs/${job.id}`),job);
  tx.set(control,{pending:pending+jobs.length},{merge:true});tx.set(usage,{lastRefreshAt:now},{merge:true});
  return {created:jobs.map(j=>j.id),reused};
 });
}
export async function claimJob():Promise<Job|null>{
 const d=db();const state=await d.doc('system/queue').get();
 if(state.data()?.paused||(state.data()?.leaseUntil??0)>Date.now())return null;
 const used=await d.doc(`usage/${dailyKey()}`).get();if((used.data()?.searches??0)>=limits().daily)return null;
 const snap=await d.collection('jobs').where('status','in',['queued','running']).limit(200).get();
 const candidate=snap.docs.map(x=>x.data() as Job).filter(j=>canClaim(j,Date.now())).sort((a,b)=>a.createdAt-b.createdAt)[0];
 if(!candidate)return null;
 return d.runTransaction(async tx=>{
  const lock=d.doc('system/queue'),ref=d.doc(`jobs/${candidate.id}`);
  const [state,doc]=await tx.getAll(lock,ref);const now=Date.now();const j=doc.data() as Job;
  if(!j||state.data()?.paused||(state.data()?.leaseUntil??0)>now||!canClaim(j,now))return null;
  const token=randomUUID();const claimed={...j,status:'running' as const,leaseToken:token,leaseUntil:now+LEASE_MS,updatedAt:now};
  tx.update(ref,claimed);tx.set(lock,{activeJob:j.id,leaseToken:token,leaseUntil:now+LEASE_MS},{merge:true});return claimed;
 });
}
export async function heartbeat(job:Job){const d=db();return d.runTransaction(async tx=>{const ref=d.doc(`jobs/${job.id}`),lock=d.doc('system/queue');const [a,b]=await tx.getAll(ref,lock);if(a.data()?.leaseToken!==job.leaseToken||b.data()?.leaseToken!==job.leaseToken||a.data()?.status!=='running')throw new Error('Worker lease lost');const expiry=Date.now()+LEASE_MS;tx.update(ref,{leaseUntil:expiry});tx.update(lock,{leaseUntil:expiry});return !!a.data()?.cancelRequested;});}
export async function reserveSearch(job:Job){const d=db();return d.runTransaction(async tx=>{const ref=d.doc(`usage/${dailyKey()}`),j=d.doc(`jobs/${job.id}`);const [usage,doc]=await tx.getAll(ref,j);if(doc.data()?.leaseToken!==job.leaseToken)throw new Error('Worker lease lost');const used=usage.data()?.searches??0;if(used>=limits().daily)return false;tx.set(ref,{searches:used+1,day:dailyKey()});return true;});}
export async function finishJob(job:Job,status:Job['status'],message:string){const d=db();await d.runTransaction(async tx=>{const ref=d.doc(`jobs/${job.id}`),lock=d.doc('system/queue');const [a,b]=await tx.getAll(ref,lock);if(a.data()?.leaseToken!==job.leaseToken||b.data()?.leaseToken!==job.leaseToken)throw new Error('Worker lease lost');const terminal=['completed','cancelled'].includes(status);tx.update(ref,{status,message,leaseUntil:0,leaseToken:null,updatedAt:Date.now()});tx.set(lock,{leaseUntil:0,leaseToken:null,activeJob:null,pending:Math.max(0,(b.data()?.pending??1)-(terminal?1:0)),...(status==='paused'?{paused:true,blocker:message}:{})},{merge:true});});}
export async function saveObservation(o:Observation,job?:Job){
 if(job&&(o.destination!==job.destination||o.departure!==job.dates[job.cursor]))throw new Error('Worker itinerary does not match cursor');
 const d=db(),id=itineraryId(o.destination,o.departure);const historyId=createHash('sha256').update(id+o.checkedAt).digest('hex');
 await d.runTransaction(async tx=>{
  const ref=d.doc(`fares/${id}`),route=d.doc(`destinations/${o.destination}`);
  const reads=await tx.getAll(ref,route,...(job?[d.doc(`jobs/${job.id}`),d.doc('system/queue')]:[]));
  if(job&&(reads[2].data()?.leaseToken!==job.leaseToken||reads[3].data()?.leaseToken!==job.leaseToken||reads[2].data()?.cursor!==job.cursor||reads[2].data()?.status!=='running'))throw new Error('Worker lease or cursor lost');
  tx.set(ref,mergeObservation(reads[0].data() as FareRecord|undefined,o));
  tx.set(d.doc(`observations/${historyId}`),o);
  if(o.status==='verified'&&reads[1].exists)tx.update(route,{directStatus:'verified',verifiedAt:o.checkedAt});
  if(job)tx.update(d.doc(`jobs/${job.id}`),{cursor:job.cursor+1,updatedAt:Date.now(),message:`Checked ${job.cursor+1} of ${job.dates.length}`,failures:o.status==='failed'?job.failures+1:0});
 });
}
export async function cancelJob(id:string,user:{uid:string;owner:boolean}){const d=db();await d.runTransaction(async tx=>{const ref=d.doc(`jobs/${id}`),control=d.doc('system/queue');const [doc,state]=await tx.getAll(ref,control);if(!doc.exists)throw new HttpError(404,'Job not found');const j=doc.data() as Job;if(!user.owner&&j.uid!==user.uid)throw new HttpError(403,'You cannot cancel this scan');if(['completed','cancelled'].includes(j.status))return;if(j.status==='running'){tx.update(ref,{cancelRequested:true});}else{tx.update(ref,{status:'cancelled',updatedAt:Date.now(),message:'Cancelled'});tx.set(control,{pending:Math.max(0,(state.data()?.pending??1)-1)},{merge:true});}});}
export async function resumeCollection(){const d=db();await d.runTransaction(async tx=>{const state=d.doc('system/queue');const paused=await tx.get(d.collection('jobs').where('status','==','paused').limit(200));for(const doc of paused.docs)tx.update(doc.ref,{status:'queued',message:'Resumed by owner',failures:0,updatedAt:Date.now()});tx.set(state,{paused:false,blocker:null},{merge:true});});}
