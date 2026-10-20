import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {routeSchema,dateSchema,mondayAfter,pairSchema} from '../lib/domain';
import {Collector} from './collector';
const file=process.argv[2];if(!file)throw new Error('Usage: npm run worker:pilot -- /path/to/pilot.json');
const single=process.argv.includes('--single');
const cases=z.array(z.object({route:routeSchema,date:dateSchema,returnDate:dateSchema.optional()})).min(single?1:3).max(single?1:6).parse(JSON.parse(await readFile(file,'utf8')));
if(!single&&(!cases.some(c=>c.route.kind==='international')||!cases.some(c=>c.route.kind==='domestic')))throw new Error('Pilot requires domestic and international itineraries');
for(const c of cases)pairSchema.parse({departure:c.date,returnDate:c.returnDate??mondayAfter(c.date)});
const collector=new Collector();const observations=[];await collector.start();
try{for(const c of cases){observations.push(await collector.collect(c.route,c.date,c.returnDate??mondayAfter(c.date)));console.log(`Verified ${c.route.code} ${c.date}`);}}finally{await collector.close();}
await mkdir('worker/artifacts',{recursive:true});await writeFile(single?'worker/artifacts/single-pilot-results.json':'worker/artifacts/pilot-results.json',JSON.stringify({version:1,destinations:[...new Map(cases.map(c=>[c.route.code,c.route])).values()],observations},null,2));
console.log(single?'Single-route diagnostic passed; this does not approve collection.':'Pilot completed. Inspect screenshots, times, two-adult totals, travel-tax treatment and browser memory before approving collection.');
