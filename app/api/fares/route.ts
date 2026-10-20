import {z} from 'zod';
import {configured,db} from '@/lib/server/admin';
import {referenceFares} from '@/lib/reference';
import {combinations,mergeObservation,searchSchema,type FareRecord} from '@/lib/domain';
import {failure} from '@/lib/server/http';
const query=z.object({search:z.string().max(5000),cursor:z.coerce.number().int().min(0).max(500).default(0)});
export async function GET(req:Request){try{
 const {search,cursor}=query.parse(Object.fromEntries(new URL(req.url).searchParams));
 let input;try{input=JSON.parse(search);}catch{throw new z.ZodError([{code:'custom',path:['search'],message:'Invalid search JSON'}]);}
 const config=searchSchema.parse(input),items=combinations(config),page=items.slice(cursor,cursor+50);
 const fares:FareRecord[]=[];
 if(!configured()){for(const item of page){const f=referenceFares.find(f=>f.id===item.id);if(f)fares.push(f);}}
 else if(page.length){
  const d=db(),docs=await d.getAll(...page.flatMap(i=>[d.doc(`fares/${i.id}`),d.doc(`fares/${i.destination}_${i.departure}`)]));
  page.forEach((item,i)=>{let f=docs[i*2].data() as FareRecord|undefined;const old=docs[i*2+1].data() as FareRecord|undefined;if(old?.returnDate===item.returnDate){if(old.lastVerified)f=mergeObservation(f,old.lastVerified);f=mergeObservation(f,old.latest);}if(f)fares.push(f);});
 }
 return Response.json({fares,nextCursor:cursor+50<items.length?cursor+50:null,total:items.length,reference:!configured()},{headers:{'Cache-Control':'public, s-maxage=60'}});
}catch(e){return failure(e);}}
