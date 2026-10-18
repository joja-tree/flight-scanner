import { auth } from './admin';
import { HttpError } from './policy';
import { ZodError } from 'zod';
export async function identity(req:Request){
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token)throw new HttpError(401,'Sign in to continue');
 try{const user=await auth().verifyIdToken(token,true);if(!user.email_verified)throw new HttpError(403,'Verify your email first');return {uid:user.uid,owner:!!process.env.OWNER_UID&&user.uid===process.env.OWNER_UID};}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(401,'Sign in again');}
}
export function checkOrigin(req:Request){const expected=process.env.APP_ORIGIN;if(!expected||new URL(expected).origin!==req.headers.get('origin'))throw new HttpError(403,'Request origin is not allowed');}
export async function body(req:Request,max=300000){if(Number(req.headers.get('content-length')??0)>max)throw new HttpError(413,'Request is too large');const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Missing request');let total=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new HttpError(413,'Request is too large');}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new HttpError(400,'Invalid JSON');}}
export function failure(e:unknown){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status});if(e instanceof ZodError)return Response.json({error:e.issues.map(i=>i.message).join('; ')},{status:400});console.error(e instanceof Error?e.message:'Unexpected error');return Response.json({error:'Service unavailable. Saved results are unchanged.'},{status:503});}
