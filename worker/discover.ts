import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
// Discovery exports visible destination names for owner reconciliation, never claims nonstop coverage.
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({locale:'en-PH'});await page.goto('https://www.cebupacificair.com/en-PH/',{waitUntil:'domcontentloaded'});
 await page.locator('input[id="originFormControl-0"]').first().click();
 await page.getByText('Cebu',{exact:true}).first().click();
 await page.locator('input[id="\'destinationFormControl-0"]').first().click();
 const countries=['Australia','Brunei Darussalam','China','Hong Kong (China)','Indonesia','Japan','Macau (China)','Malaysia','Philippines','Saudi Arabia','Singapore','South Korea','Taiwan (China)','Thailand','United Arab Emirates','Vietnam'];
 const visible:Record<string,string[]>={};
 for(const country of countries){const link=page.getByText(country,{exact:true});if(!await link.count())continue;await link.first().click();const text=await page.locator('body').innerText();visible[country]=text.split('\n').map(t=>t.trim()).filter(Boolean);}
 await mkdir('worker/artifacts',{recursive:true});await writeFile('worker/artifacts/discovery.json',JSON.stringify({checkedAt:new Date().toISOString(),source:page.url(),note:'Raw visible menus, includes surrounding page text. Reconcile airport codes and countries; these are candidates, not confirmed direct routes.',visible},null,2));
 console.log('Saved raw menu evidence. Review and import candidate destinations; verify nonstop service through searches.');
}finally{await browser.close();}
