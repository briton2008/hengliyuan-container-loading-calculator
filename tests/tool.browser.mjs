import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {containerCopy,containerSlug} from '../src/container-loading-content.mjs';
import {tmpdir} from 'node:os';
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5214',out=process.env.QA_OUTPUT||tmpdir()+'/hly-container-github-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[],errors=[],leaks=[],marker='QA-CONTAINER-Home-{1}';
try{
 for(const width of [1440,390]){ const code='EN';
  const c=containerCopy(code),context=await browser.newContext({viewport:{width,height:950},permissions:['clipboard-read','clipboard-write']}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(((r.url()+(r.postData()||'')).includes(marker)||(r.url()+(r.postData()||'')).includes(encodeURIComponent(marker))))leaks.push(r.url());});
  await p.goto(base+'/');await p.getByRole('heading',{level:1,name:c.title,exact:true}).waitFor();
  for(const [name,value]of [[c.cargoLength,'500'],[c.cargoWidth,'400'],[c.cargoHeight,'300'],[c.gross,'20']])await p.getByRole('spinbutton',{name,exact:true}).fill(value);
  await p.getByRole('combobox',{name:c.rotation,exact:true}).selectOption('fixed');await p.getByRole('combobox',{name:c.stack,exact:true}).selectOption('stack');
  await p.getByText(c.optional,{exact:true}).click();for(const [name,value]of [[c.net,'18'],[c.units,'10'],[c.order,'1000']])await p.getByRole('spinbutton',{name,exact:true}).fill(value);
  await p.getByText(c.advanced,{exact:true}).click();await p.getByRole('textbox',{name:c.project,exact:true}).fill(marker);await p.getByText(c.advanced,{exact:true}).click();
  await p.getByRole('button',{name:c.calculate,exact:true}).click();await p.getByTestId('container-count').waitFor();assert.equal(await p.getByTestId('container-count').innerText(),'385');
  const cards=p.locator('.container-comparison article');assert.equal(await cards.count(),3);for(const [i,count]of ['385','840','1,080'].entries())assert.equal(await cards.nth(i).locator('span').innerText(),count);
  const record=await p.getByRole('textbox',{name:c.record,exact:true}).inputValue();assert.ok(record.includes(marker));assert.ok(record.includes('7,700 kg'));assert.ok(record.includes('6,930 kg'));assert.ok(record.includes('3,850'));
  await p.getByRole('button',{name:c.copy,exact:true}).click();assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),record);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),code+' overflow');
  await p.locator('.container-comparison').scrollIntoViewIfNeeded();if(['EN','CN','TC','AR'].includes(code))await p.screenshot({path:out+'/'+code+'-'+width+'-result.png'});
  if(['EN','CN','TC'].includes(code)){await p.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true;};});await p.getByRole('button',{name:c.print,exact:true}).click();assert.ok(await p.evaluate(()=>window.__printed));await p.emulateMedia({media:'print'});assert.equal(await p.locator('.topbar').isVisible(),false);assert.ok(await p.locator('.company-document-name').isVisible());await p.pdf({path:out+'/'+code+'-'+width+'-loading.pdf',format:'A4',printBackground:true});await p.emulateMedia({media:'screen'});await writeFile(out+'/'+code+'-'+width+'-record.txt',record);}
  if(width===1440){
   await p.getByRole('spinbutton',{name:c.cargoHeight,exact:true}).fill('2350');await p.getByRole('button',{name:c.calculate,exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-testid="container-count"]')?.textContent==='0');assert.ok(await p.getByText(c.doorBlocked,{exact:true}).count());
   await p.getByRole('spinbutton',{name:c.cargoHeight,exact:true}).fill('300');await p.getByRole('spinbutton',{name:c.gross,exact:true}).fill('10');await p.getByRole('spinbutton',{name:c.net,exact:true}).fill('20');await p.getByRole('button',{name:c.calculate,exact:true}).click();await p.locator('[role="alert"]').waitFor();assert.equal(await p.getByTestId('container-count').count(),0);
  }
  results.push({code,width,comparison:[385,840,1080],copy:true,private_reference_preserved:true,no_overflow:true});console.log(code,'passed');await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(leaks,[]);await writeFile(out+'/results.json',JSON.stringify({base,status:'passed',results,page_errors:errors,customer_marker_network_leaks:leaks},null,2));
}finally{await browser.close();}
