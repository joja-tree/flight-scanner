import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
test('all direct clients, including forged owner claims, cannot write fares or jobs',async()=>{const env=await initializeTestEnvironment({projectId:'demo-cebu-finder',firestore:{rules:await readFile('firestore.rules','utf8')}});try{for(const client of [env.unauthenticatedContext(),env.authenticatedContext('alice'),env.authenticatedContext('attacker',{owner:true,admin:true})]){for(const path of ['fares/BCD_2027-03-05','jobs/2027_BCD_03','system/queue','destinations/BCD']){await assertFails(setDoc(doc(client.firestore(),path),{total:0}));await assertFails(getDoc(doc(client.firestore(),path)));}}}finally{await env.cleanup();}});
