import {identity,failure} from '@/lib/server/http';
import {db} from '@/lib/server/admin';
export async function GET(req:Request){try{const user=await identity(req);const state=user.owner?await db().doc('system/queue').get():null;return Response.json({...user,publicRefresh:false,blocker:state?.data()?.blocker??null},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
