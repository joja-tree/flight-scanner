export type FlightCard={flight:string;from:string;to:string;departure:string;arrival:string;amount:number;nextDay:boolean;text:string};
export function centavos(value:string){const n=Number(value.replace(/,/g,''));if(!Number.isFinite(n)||n<=0)throw new Error('Invalid money');return Math.round(n*100);}
export function clock(hour:string,minute:string,period:string){return `${String(Number(hour)%12+(period.toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${minute}`;}
export function parseFlightCard(raw:string):FlightCard|null{
 const text=raw.replace(/\s+/g,' ').trim();
 if((text.match(/Depart\s*-\s*[A-Z]{3}/g)||[]).length!==1||(text.match(/Arrive\s*-\s*[A-Z]{3}/g)||[]).length!==1||/layover|connecting/i.test(text))return null;
 const depart=text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*Depart\s*-\s*([A-Z]{3})/i);
 const arrive=text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*Arrive\s*-\s*([A-Z]{3})/i);
 const flight=text.match(/\b(5J|DG)\s*(\d{1,5})\b/);const price=text.match(/All-in\s*Fare\s*\/\s*guest\s*PHP\s*([\d,]+\.\d{2})/i);
 if(!depart||!arrive||!flight||!price)return null;
 return {flight:`${flight[1]} ${flight[2]}`,from:depart[4],to:arrive[4],departure:clock(depart[1],depart[2],depart[3]),arrival:clock(arrive[1],arrive[2],arrive[3]),amount:centavos(price[1]),nextDay:/\+\s*1\s*(day)?|next day/i.test(text),text};
}
export function verifySummary(text:string,destination:string,out:FlightCard,back:FlightCard,departure:string,returnDate:string){
 const normalized=text.replace(/\s+/g,' ');
 const summary=normalized.slice(normalized.indexOf('Booking Summary'));
 const label=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
 if(!summary.includes(label(departure))||!summary.includes(label(returnDate)))throw new Error('Booking summary dates do not match requested trip');
 const totals=[...normalized.matchAll(/\bTotal\s+PHP\s*([\d,]+\.\d{2})/g)];
 const subtotal=[...normalized.matchAll(/Subtotal\s+PHP\s*([\d,]+\.\d{2})/g)].map(m=>centavos(m[1]));
 const total=totals.length?centavos(totals.at(-1)![1]):null;
 if(!normalized.includes('Booking Summary')||!normalized.includes(destination)||!normalized.includes('Adult 2')||subtotal.length!==2||subtotal[0]!==out.amount*2||subtotal[1]!==back.amount*2||total!==2*(out.amount+back.amount))throw new Error('Booking summary did not confirm both adults and both flight totals');
 return total;
}
