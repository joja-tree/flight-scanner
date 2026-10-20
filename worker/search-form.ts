import type {Page} from 'playwright';
import {mondayAfter,type Destination} from '../lib/domain';

/** Navigate the visible booking form so the airline initializes its search session. */
export async function searchFromHomepage(page:Page,route:Destination,date:string,returnDate=mondayAfter(date)){
 const response=await page.goto('https://www.cebupacificair.com/en-PH/',{waitUntil:'domcontentloaded',timeout:45000});
 // Airline menu items do not consistently expose the ARIA link role.
 const airport=async(placeholder:string,country:string,name:string)=>{
  await page.getByPlaceholder(placeholder,{exact:true}).filter({visible:true}).first().click();
  const countryItem=page.locator('.hero').getByText(country,{exact:true}).filter({visible:true}).first();
  const group=countryItem.locator('..');
  const airportName=name==='Hong Kong'?'HongKong':name;
  const option=group.locator('ul').getByText(airportName,{exact:true}).filter({visible:true});
  if(!await option.count())await countryItem.click();
  await option.click();
 };
 await airport('Select Origin','Philippines','Cebu');
 await airport('Select Destination',route.country,route.name);
 await page.getByPlaceholder('Departing on',{exact:true}).filter({visible:true}).first().click();
 const pickDate=async(value:string)=>{
  const d=new Date(value+'T12:00:00Z');
  const title=d.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
  const month=page.locator('.c-calendar-month').filter({hasText:title}).filter({visible:true});
  for(let i=0;!await month.count();i++){
   if(i>=18)throw new Error(`Date ${value} not reachable in booking calendar; release status unconfirmed`);
   const next=page.locator('.c-calendar-month-next').filter({visible:true}).first();
   const before=await page.locator('.c-calendar-month-pick').allTextContents();
   await next.click();
   await page.waitForFunction(previous=>JSON.stringify(Array.from(document.querySelectorAll('.c-calendar-month-pick')).map(e=>e.textContent))!==JSON.stringify(previous),before,{timeout:5000});
  }
  await month.locator('.c-calendar-month__cell-date').getByText(String(d.getUTCDate()),{exact:true}).click();
 };
 await pickDate(date);await pickDate(returnDate);
 await page.getByRole('button',{name:/select dates/i}).filter({visible:true}).click();
 const adults=page.locator('.o-form_input:has(.dropdown-adult-toggle) input').filter({visible:true});
 if(!await adults.count())await page.getByRole('button',{name:/search flights/i}).filter({visible:true}).first().click().catch(async error=>{if(!await adults.count())throw error;});
 await adults.fill('2');await adults.press('Tab');
 await page.getByRole('button',{name:/search flights/i}).filter({visible:true}).last().click();
 await page.waitForURL(url=>url.pathname.includes('/booking/select-flight')&&url.searchParams.get('adt')==='2'&&url.searchParams.get('o1')==='CEB'&&url.searchParams.get('d1')===route.code&&url.searchParams.get('dd1')===date&&url.searchParams.get('dd2')===returnDate,{timeout:45000});
 return response?.status()??null;
}
