import { z } from 'zod';
export const YEAR = 2027;
export const dateSchema = z.iso.date();
export function mondayAfter(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
export function departures(month?: number): string[] {
  const result: string[] = [];
  for (let d = new Date(Date.UTC(YEAR, 0, 1, 12)); d.getUTCFullYear() === YEAR; d.setUTCDate(d.getUTCDate() + 1)) {
    if ([4, 5].includes(d.getUTCDay()) && (!month || d.getUTCMonth() + 1 === month)) result.push(d.toISOString().slice(0, 10));
  }
  return result;
}
export const airportSchema = z.string().regex(/^[A-Z]{3}$/).refine(v => v !== 'CEB', 'Destination must differ from Cebu');
export const routeSchema = z.object({
  code: airportSchema, name: z.string().min(1).max(100), country: z.string().min(1).max(100),
  kind: z.enum(['domestic', 'international']), directStatus: z.enum(['candidate', 'verified']),
  verifiedAt: z.iso.datetime().nullable(), source: z.string().url().refine(v => new URL(v).protocol==='https:'&&(new URL(v).hostname==='cebupacificair.com'||new URL(v).hostname.endsWith('.cebupacificair.com'))),
}).strict().superRefine((r,ctx)=>{if(r.directStatus==='verified'&&!r.verifiedAt)ctx.addIssue({code:'custom',message:'Verified route requires observation timestamp'});});
export type Destination = z.infer<typeof routeSchema>;
export const legSchema = z.object({ flight: z.string().regex(/^(5J|DG)\s?\d{1,5}$/), from: z.string().regex(/^[A-Z]{3}$/), to: z.string().regex(/^[A-Z]{3}$/), date: dateSchema, departure: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), arrival: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), arrivalDate: dateSchema, amountPerAdult: z.number().int().positive(), baggage: z.string().min(1).max(300) }).strict();
export const quoteSchema = z.object({ total: z.number().int().positive(), currency: z.literal('PHP'), adults: z.literal(2), outbound: legSchema, inbound: legSchema, travelTax: z.enum(['included', 'excluded', 'not-applicable', 'unknown']), verifiedInSummary: z.literal(true) }).strict().superRefine((q, ctx) => {
  if (q.total !== 2 * (q.outbound.amountPerAdult + q.inbound.amountPerAdult)) ctx.addIssue({code:'custom',message:'Total must match the two-adult fare breakdown'});
});
export const observationSchema = z.object({
  destination: airportSchema, departure: dateSchema, returnDate: dateSchema,
  status: z.enum(['verified','indicative','unavailable','unreleased','failed','blocked']),
  checkedAt: z.iso.datetime(), quote: quoteSchema.nullable(), indicativeBaseFare: z.number().int().positive().nullable(),
  note: z.string().max(1000), evidence: z.string().min(1).max(500),
}).strict().superRefine((o, ctx) => {
  const add = (message: string) => ctx.addIssue({code:'custom',message});
  if (o.returnDate <= o.departure) add('Return date must follow departure');
  if (o.status === 'verified' && !o.quote) add('Verified observation requires a confirmed quote');
  if (o.status !== 'verified' && o.quote) add('Only verified observations may contain a quote');
  if (o.status === 'indicative' && o.indicativeBaseFare === null) add('Indicative observations require a base fare');
  if (o.status !== 'indicative' && o.indicativeBaseFare !== null) add('Base fares must be labeled indicative');
  if (Date.parse(o.checkedAt) > Date.now() + 300000) add('Observation cannot be in the future');
  if (o.quote) {
    const {outbound:a,inbound:b}=o.quote;
    if (a.from!=='CEB'||a.to!==o.destination||b.from!==o.destination||b.to!=='CEB') add('Quote must be a direct Cebu round trip');
    if (a.date!==o.departure||b.date!==o.returnDate) add('Flight dates must match itinerary');
    if (a.arrivalDate < a.date || a.arrivalDate > o.returnDate || b.arrivalDate !== o.returnDate) add('Flights must arrive on the selected return date');
  }
});
export type Observation = z.infer<typeof observationSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type FareRecord = { id: string; destination: string; departure: string; returnDate: string; month: number; latest: Observation; lastVerified: Observation | null };
export function itineraryId(destination: string, departure: string, returnDate=mondayAfter(departure)) { return `${destination}_${departure}_${returnDate}`; }
export function mergeObservation(previous: FareRecord | undefined, o: Observation): FareRecord {
  const newer = !previous || o.checkedAt >= previous.latest.checkedAt;
  const verified = o.status === 'verified' && (!previous?.lastVerified || o.checkedAt >= previous.lastVerified.checkedAt) ? o : previous?.lastVerified ?? null;
  return {id:itineraryId(o.destination,o.departure,o.returnDate),destination:o.destination,departure:o.departure,returnDate:o.returnDate,month:Number(o.departure.slice(5,7)),latest:newer?o:previous!.latest,lastVerified:verified};
}
export function bookingUrl(destination: string, departure: string, returnDate=mondayAfter(departure)) {
  const q = new URLSearchParams({o1:'CEB',d1:destination,adt:'2',chd:'0',inl:'0',inf:'0',dd1:departure,dd2:returnDate});
  return `https://www.cebupacificair.com/en-PH/booking/select-flight?${q}`;
}
export const money = (centavos: number) => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(centavos/100);
export function stale(o: Observation, now=Date.now()) { return now-Date.parse(o.checkedAt)>24*60*60*1000; }
export const importSchema = z.object({version:z.literal(1),destinations:z.array(routeSchema).max(100),observations:z.array(observationSchema).max(100)}).strict().superRefine((b,ctx)=>{
  const ids=b.observations.map(o=>itineraryId(o.destination,o.departure,o.returnDate)+'_'+o.checkedAt);
  if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Duplicate observations in import'});
  if(new Set(b.destinations.map(d=>d.code)).size!==b.destinations.length)ctx.addIssue({code:'custom',message:'Duplicate destinations in import'});
});
export const pairSchema=z.object({departure:dateSchema,returnDate:dateSchema}).strict().refine(p=>p.returnDate>p.departure,'Return date must follow departure');
export type DatePair=z.infer<typeof pairSchema>;
export const searchSchema=z.object({
 pairs:z.array(pairSchema).min(1).max(5), destinations:z.array(airportSchema).min(1).max(100),
}).strict().transform(s=>({pairs:[...new Map(s.pairs.map(p=>[p.departure+'_'+p.returnDate,p])).values()].sort((a,b)=>a.departure.localeCompare(b.departure)||a.returnDate.localeCompare(b.returnDate)),destinations:[...new Set(s.destinations)].sort()}));
// Jobs structurally contain a search, but their operational fields must never enter a public fare query.
export function fareQuery(input:{pairs:DatePair[];destinations:string[]},cursor=0){
 const search=searchSchema.parse({pairs:input.pairs,destinations:input.destinations});
 return new URLSearchParams({search:JSON.stringify(search),cursor:String(cursor)}).toString();
}
export const refreshSchema=z.object({scope:z.literal('search'),pairs:z.array(pairSchema).min(1).max(5),destinations:z.array(airportSchema).min(1).max(100),force:z.boolean().default(false)}).strict().transform(s=>({...searchSchema.parse({pairs:s.pairs,destinations:s.destinations}),scope:s.scope,force:s.force}));
export type RefreshRequest=z.infer<typeof refreshSchema>;
export type Job={id:string;kind:'search';uid:string;pairs:DatePair[];destinations:string[];excluded:string[];done:string[];force:boolean;status:'queued'|'running'|'paused'|'completed'|'cancelled';createdAt:number;updatedAt:number;leaseUntil:number;leaseToken:string|null;cancelRequested:boolean;message:string;failures:number};
export function combinations(s:{pairs:DatePair[];destinations:string[]}){return s.pairs.flatMap(p=>s.destinations.map(destination=>({...p,destination,id:itineraryId(destination,p.departure,p.returnDate)})));}
export function nextItinerary(j:Job){return combinations(j).find(x=>!j.excluded.includes(x.destination)&&!j.done.includes(x.id));}
export function rankDestinations(fares:FareRecord[],excluded:string[]=[],budget=Infinity){
 const sorted=fares.filter(f=>!excluded.includes(f.destination)&&f.lastVerified?.quote&&f.lastVerified.quote.total<=budget).sort((a,b)=>a.lastVerified!.quote!.total-b.lastVerified!.quote!.total||a.destination.localeCompare(b.destination)||a.departure.localeCompare(b.departure)||a.returnDate.localeCompare(b.returnDate));
 return [...new Map(sorted.map(f=>f.destination).map(code=>[code,sorted.find(f=>f.destination===code)!])).values()].slice(0,5);
}
