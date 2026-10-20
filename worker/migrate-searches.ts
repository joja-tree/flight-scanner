import {FieldPath} from 'firebase-admin/firestore';
import {db} from '../lib/server/admin';
import {cancelJob,saveObservation} from '../lib/server/queue';
import {itineraryId,type FareRecord} from '../lib/domain';
// Idempotent cutover. No histories are deleted. Run with the continuous worker stopped.
const apply=process.argv.includes('--apply');
const d=db();const jobs=await d.collection('jobs').where('status','in',['queued','running','paused']).limit(200).get();
const legacy=jobs.docs.filter(j=>j.data().kind!=='search');
console.log(`${legacy.length} active legacy jobs; mode=${apply?'apply':'dry run'}`);
if(apply)for(const j of legacy)await cancelJob(j.id,{uid:'migration',owner:true});
const state=await d.doc('system/queue').get();
if((state.data()?.leaseUntil??0)>Date.now())throw new Error('Worker lease still active. Stop the old worker and rerun after its lease expires; cancellation has been requested.');
if(apply){
 // Expired running jobs can be cancelled and fenced once their worker is stopped.
 await d.runTransaction(async tx=>{
  const control=d.doc('system/queue');const [lock,...docs]=await tx.getAll(control,...legacy.map(j=>j.ref));
  if((lock.data()?.leaseUntil??0)>Date.now())throw new Error('Worker acquired a lease; stop it before migration');
  let removed=0;for(const doc of docs)if(doc.data()?.status==='running'){tx.update(doc.ref,{status:'cancelled',cancelRequested:true,leaseToken:null,leaseUntil:0,updatedAt:Date.now(),message:'Retired full-year/month scan'});removed++;}
  tx.set(control,{pending:Math.max(0,(lock.data()?.pending??0)-removed),leaseUntil:0,leaseToken:null,activeJob:null},{merge:true});
 });
}
let cursor:string|undefined,count=0;
do{
 let q=d.collection('fares').orderBy(FieldPath.documentId()).limit(50);if(cursor)q=q.startAfter(cursor);
 const page=await q.get();if(page.empty)break;
 for(const doc of page.docs){const f=doc.data() as FareRecord;if(doc.id===itineraryId(f.destination,f.departure,f.returnDate))continue;count++;
  if(apply){if(f.lastVerified)await saveObservation(f.lastVerified);await saveObservation(f.latest);}
 }
 cursor=page.docs.at(-1)!.id;
}while(cursor);
console.log(`${count} legacy fare snapshots ${apply?'migrated':'would migrate'}; observation history retained.`);
