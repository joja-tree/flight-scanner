import {checkOrigin,failure,identity} from '@/lib/server/http';
import {HttpError} from '@/lib/server/policy';
import {resumeCollection} from '@/lib/server/queue';
export async function POST(req:Request){try{checkOrigin(req);if(!(await identity(req)).owner)throw new HttpError(403,'Owner access required');await resumeCollection();return Response.json({ok:true});}catch(e){return failure(e);}}
