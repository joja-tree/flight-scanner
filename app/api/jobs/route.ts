import {db} from '@/lib/server/admin';
import {body,checkOrigin,failure,identity} from '@/lib/server/http';
import {cancelJob} from '@/lib/server/queue';
import {z} from 'zod';
export async function GET(req:Request){try{const user=await identity(req);let q=db().collection('jobs').orderBy('updatedAt','desc').limit(30);if(!user.owner)q=q.where('uid','==',user.uid);const [jobs,state]=await Promise.all([q.get(),db().doc('system/queue').get()]);return Response.json({jobs:jobs.docs.map(x=>{const {leaseToken,...j}=x.data();return {...j,leaseToken:null};}),paused:state.data()?.paused??false,blocker:state.data()?.blocker??null},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{checkOrigin(req);const user=await identity(req);const {id}=z.object({id:z.string().regex(/^2027_[A-Z]{3}_\d{2}$/)}).strict().parse(await body(req,4096));await cancelJob(id,user);return Response.json({ok:true});}catch(e){return failure(e);}}
