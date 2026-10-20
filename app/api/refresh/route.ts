import { refreshSchema } from '@/lib/domain';
import { body, checkOrigin, failure, identity } from '@/lib/server/http';
import { enqueue } from '@/lib/server/queue';
export const runtime='nodejs';
export async function POST(req:Request){try{checkOrigin(req);const user=await identity(req);return Response.json(await enqueue(refreshSchema.parse(await body(req,8192)),user));}catch(e){return failure(e);}}
