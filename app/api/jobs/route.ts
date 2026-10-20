import {db} from '@/lib/server/admin';
import {body,checkOrigin,failure,identity} from '@/lib/server/http';
import {cancelJob,setExclusions,jobIdSchemaPattern} from '@/lib/server/queue';
import {HttpError} from '@/lib/server/policy';
import {airportSchema} from '@/lib/domain';
import {z} from 'zod';
const idSchema=z.string().regex(jobIdSchemaPattern);
export async function GET(req:Request){try{
 const user=await identity(req),id=new URL(req.url).searchParams.get('id');
 const docs=id?[await db().doc(`jobs/${idSchema.parse(id)}`).get()]:(await db().collection('jobs').orderBy('updatedAt','desc').limit(30).get()).docs;
 const jobs=docs.filter(d=>d.exists&&d.data()?.kind==='search'&&(user.owner||d.data()?.uid===user.uid)).map(d=>({...d.data(),leaseToken:null}));
 if(id&&!jobs.length)throw new HttpError(404,'Search not found');
 const state=await db().doc('system/queue').get();return Response.json({jobs,blocker:state.data()?.blocker??null},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
export async function POST(req:Request){try{checkOrigin(req);const user=await identity(req);const {id}=z.object({id:idSchema}).strict().parse(await body(req,4096));await cancelJob(id,user);return Response.json({ok:true});}catch(e){return failure(e);}}
export async function PATCH(req:Request){try{checkOrigin(req);const user=await identity(req);const {id,excluded}=z.object({id:idSchema,excluded:z.array(airportSchema).max(100)}).strict().parse(await body(req,4096));await setExclusions(id,excluded,user);return Response.json({ok:true});}catch(e){return failure(e);}}
