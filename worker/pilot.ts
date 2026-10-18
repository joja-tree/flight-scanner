import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {routeSchema,dateSchema,departures} from '../lib/domain';
import {Collector} from './collector';
const file=process.argv[2];if(!file)throw new Error('Usage: npm run worker:pilot -- /path/to/pilot.json');
const cases=z.array(z.object({route:routeSchema,date:dateSchema.refine(v=>departures().includes(v))})).min(3).max(6).parse(JSON.parse(await readFile(file,'utf8')));
if(!cases.some(c=>c.route.kind==='international')||!cases.some(c=>c.route.kind==='domestic'))throw new Error('Pilot requires domestic and international itineraries');
const collector=new Collector();const observations=[];await collector.start();
try{for(const c of cases){observations.push(await collector.collect(c.route,c.date));console.log(`Verified ${c.route.code} ${c.date}`);}}finally{await collector.close();}
await mkdir('worker/artifacts',{recursive:true});await writeFile('worker/artifacts/pilot-results.json',JSON.stringify({version:1,destinations:[...new Map(cases.map(c=>[c.route.code,c.route])).values()],observations},null,2));
console.log('Pilot completed. Inspect screenshots, times, two-adult totals, travel-tax treatment and browser memory before approving collection.');
