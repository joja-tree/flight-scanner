import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export const configured=()=>Boolean(process.env.FIREBASE_PROJECT_ID);
function app(){
 if(getApps().length)return getApps()[0];
 const projectId=process.env.FIREBASE_PROJECT_ID;
 if(!projectId)throw new Error('Firebase server configuration is missing');
 const credential=process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY?cert({projectId,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')}):applicationDefault();
 return initializeApp({projectId,credential});
}
export const db=()=>getFirestore(app());
export const auth=()=>getAuth(app());
