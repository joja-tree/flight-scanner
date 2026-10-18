import {chromium,type Browser,type Page,type Locator} from 'playwright';
import {bookingUrl,mondayAfter,observationSchema,type Observation,type Destination} from '../lib/domain';
import {parseFlightCard,verifySummary,type FlightCard} from './parser';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
export class Blocked extends Error {}
export class Collector {
 browser:Browser|null=null;
 async start(){this.browser=await chromium.launch({headless:true});}
 async close(){await this.browser?.close();}
 async checkBlocked(page:Page){const t=await page.locator('body').innerText();if(/verify you are human|access denied|unusual traffic|complete the captcha|security verification/i.test(t))throw new Blocked('Airline verification or access block requires owner attention');}
 async choose(page:Page,from:string,to:string,allowOvernight=false):Promise<FlightCard>{
  // Use only rendered card content. Smallest matching DIV avoids selecting an itinerary container.
  const candidates=await page.locator('div').evaluateAll(elements=>elements.map((e,index)=>({index,text:(e as HTMLElement).innerText})).filter(x=>x.text&&x.text.includes('All-in')&&x.text.includes('Depart')));
  const parsed=candidates.map(c=>({...c,flight:parseFlightCard(c.text)})).filter(c=>c.flight&&c.flight.from===from&&c.flight.to===to&&(allowOvernight||!c.flight.nextDay));
  const unique=new Map<string,typeof parsed[number]>();
  for(const c of parsed){const key=c.flight!.flight;const old=unique.get(key);if(!old||c.text.length<old.text.length)unique.set(key,c);}
  const best=[...unique.values()].sort((a,b)=>a.flight!.amount-b.flight!.amount||a.text.length-b.text.length)[0];
  if(!best)throw new Error(`No parseable eligible direct ${from}–${to} card. Requires inspection; not labeled unavailable.`);
  await page.locator('div').nth(best.index).click();
  await page.getByText('Change',{exact:true}).first().waitFor({state:'visible',timeout:15000});
  return best.flight!;
 }
 async collect(route:Destination,date:string):Promise<Observation>{
  if(!this.browser)throw new Error('Collector not started');
  const context=await this.browser.newContext({locale:'en-PH',timezoneId:'Asia/Manila',viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const base={destination:route.code,departure:date,returnDate:mondayAfter(date),checkedAt:new Date().toISOString(),quote:null,indicativeBaseFare:null};
  try{
   await page.goto(bookingUrl(route.code,date),{waitUntil:'domcontentloaded',timeout:45000});
   await this.checkBlocked(page);
   await page.getByText('2 Adults',{exact:true}).first().waitFor({state:'visible',timeout:30000});
   await this.checkBlocked(page);
   // A missing result is never silently treated as sold out or unreleased.
   await page.getByText(/All-in\s*Fare\s*\/\s*guest/i).first().waitFor({state:'visible',timeout:30000});
   for(let n=0;n<20;n++){
    const more=page.getByText('Show More',{exact:true});if(!await more.count())break;
    await more.first().click();await page.waitForTimeout(300);
    if(n===19)throw new Error('Flight list exceeded expansion bound; cheapest fare not established');
   }
   const out=await this.choose(page,'CEB',route.code,true);
   const back=await this.choose(page,route.code,'CEB');
   await page.getByRole('button',{name:'I’m okay with fare only',exact:true}).click();
   await page.getByRole('link',{name:/PHP.*Show Details/}).first().click();
   await page.getByText('Booking Summary',{exact:true}).waitFor({state:'visible'});
   const body=await page.locator('body').innerText();
   const total=verifySummary(body,route.code,out,back,date,base.returnDate);
   if(!/7\s*kg/i.test(body)||!/hand-carry/i.test(body))throw new Error('Included baggage could not be verified');
   const baggage=(f:FlightCard)=>f.flight.startsWith('DG')?'1 hand-carry item, max 7 kg':/10\s*kg.*Cebu Pacific|Cebu Pacific.*10\s*kg/is.test(body)?'1 hand-carry item, max 10 kg':'Included hand-carry; confirm weight with airline';
   const arrivalDate=(f:FlightCard,d:string)=>{if(!f.nextDay)return d;const next=new Date(d+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);return next.toISOString().slice(0,10);};
   const leg=(f:FlightCard,d:string)=>({flight:f.flight,from:f.from,to:f.to,date:d,departure:f.departure,arrival:f.arrival,arrivalDate:arrivalDate(f,d),amountPerAdult:f.amount,baggage:baggage(f)});
   const shot=await page.screenshot({fullPage:true});const digest=createHash('sha256').update(shot).digest('hex');
   const dir=process.env.ARTIFACT_DIR??'worker/artifacts';await mkdir(dir,{recursive:true});
   await writeFile(`${dir}/${route.code}_${date}_${Date.now()}.png`,shot);
   return observationSchema.parse({...base,status:'verified',quote:{total,currency:'PHP',adults:2,outbound:leg(out,date),inbound:leg(back,base.returnDate),travelTax:route.kind==='domestic'?'not-applicable':'unknown',verifiedInSummary:true},note:'GO Basic, both adults and both legs confirmed in booking summary. Flight times are airport-local. Optional extras excluded.',evidence:`Browser booking summary screenshot SHA256:${digest}`});
  }catch(e){await this.checkBlocked(page).catch(error=>{if(error instanceof Blocked)throw error;});throw e;}
  finally{await context.close();}
 }
}
