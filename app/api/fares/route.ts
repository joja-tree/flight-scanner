import {FieldPath} from 'firebase-admin/firestore';
import {z} from 'zod';
import {configured,db} from '@/lib/server/admin';
import {referenceFares} from '@/lib/reference';
import {failure} from '@/lib/server/http';
const query=z.object({month:z.coerce.number().int().min(1).max(12),cursor:z.string().regex(/^[A-Z]{3}_2027-\d{2}-\d{2}$/).optional()});
export async function GET(req:Request){try{const {month,cursor}=query.parse(Object.fromEntries(new URL(req.url).searchParams));if(!configured())return Response.json({fares:referenceFares.filter(f=>f.month===month),nextCursor:null,reference:true});let q=db().collection('fares').where('month','==',month).orderBy(FieldPath.documentId()).limit(101);if(cursor)q=q.startAfter(cursor);const snap=await q.get();return Response.json({fares:snap.docs.slice(0,100).map(d=>d.data()),nextCursor:snap.size>100?snap.docs[99].id:null,reference:false},{headers:{'Cache-Control':'public, s-maxage=60'}});}catch(e){return failure(e);}}
