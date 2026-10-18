import {identity,failure} from '@/lib/server/http';
import {limits} from '@/lib/server/policy';
export async function GET(req:Request){try{const user=await identity(req);return Response.json({...user,publicRefresh:limits().publicRefresh},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
