// Run from an isolated tools folder with lighthouse@13.4.1 and puppeteer-core@24.
// The synthetic age state lives only in a disposable test browser; never changes production code.
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';

const [base, out, mode = 'resources'] = process.argv.slice(2);
if (!base || !out || !process.env.CHROME_PATH) throw new Error('Usage: CHROME_PATH=/path/to/chrome node measure.mjs URL OUTPUT_DIR [resources|lighthouse]');
await fs.mkdir(out, {recursive: true});
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-first-run','--no-default-browser-check','--remote-debugging-port=0']});
const port = Number(new URL(browser.wsEndpoint()).port);
const summary=[];
try {
 for (const accepted of [false,true]) {
  const reps=mode==='lighthouse'?3:1;
  for(let n=0;n<reps;n++) {
   const page=await browser.newPage();
   await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
   await page.goto(base,{waitUntil:'load'});
   await page.evaluate(accepted=>{localStorage.clear();if(accepted)localStorage.setItem('sat-age-confirmed','yes');},accepted);
   if(mode==='lighthouse') {
    await page.goto('about:blank');
    const cacheSession=await page.createCDPSession();await cacheSession.send('Network.enable');await cacheSession.send('Network.clearBrowserCache');
    const result=await lighthouse(base,{port,logLevel:'error',onlyCategories:['performance'],disableStorageReset:true,screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false}});
    const lhr=result.lhr;
    await fs.writeFile(`${out}/${accepted?'accepted':'gate'}-${n+1}.json`,JSON.stringify(lhr));
    const audits=lhr.audits;
    const row={accepted,run:n+1,score:lhr.categories.performance.score*100,metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift','total-byte-weight','mainthread-work-breakdown'].map(id=>[id,audits[id]?.numericValue])),warnings:lhr.runWarnings};
    summary.push(row);console.log(JSON.stringify(row));
   } else {
    const cdp=await page.createCDPSession();await cdp.send('Network.enable');await cdp.send('Network.clearBrowserCache');await cdp.send('Performance.enable');
    const requests=new Map();
    cdp.on('Network.responseReceived',e=>requests.set(e.requestId,{url:e.response.url,type:e.type,status:e.response.status,cache:e.response.fromDiskCache||false,bytes:0}));
    cdp.on('Network.loadingFinished',e=>{if(requests.has(e.requestId)) requests.get(e.requestId).bytes=e.encodedDataLength;});
    await page.evaluateOnNewDocument(()=>{window.__longTasks=[];new PerformanceObserver(list=>window.__longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});});
    await page.reload({waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,5000));
    const initial=await page.evaluate(()=>({ageOpen:document.querySelector('#age').open,renderer:document.querySelector('#liquid').dataset.renderer,waterRect:document.querySelector('#art-zone').getBoundingClientRect().toJSON(),longTasks:window.__longTasks,resources:performance.getEntriesByType('resource').map(x=>({url:x.name,bytes:x.transferSize,decoded:x.decodedBodySize,duration:x.duration}))}));
    const cpuStart=await cdp.send('Performance.getMetrics');await new Promise(r=>setTimeout(r,5000));const cpuEnd=await cdp.send('Performance.getMetrics');
    const metric=(m,key)=>m.metrics.find(x=>x.name===key)?.value;
    const row={accepted,initial,requests:[...requests.values()],transferBytes:[...requests.values()].reduce((s,x)=>s+x.bytes,0),idleTaskSeconds:metric(cpuEnd,'TaskDuration')-metric(cpuStart,'TaskDuration')};
    summary.push(row);console.log(JSON.stringify({accepted,ageOpen:initial.ageOpen,renderer:initial.renderer,requests:requests.size,bytes:row.transferBytes,idleTaskSeconds:row.idleTaskSeconds,longTasks:initial.longTasks}));
    await page.screenshot({path:`${out}/${accepted?'accepted':'gate'}.png`});
   }
   await page.close();
  }
 }
} finally {await browser.close();await fs.writeFile(`${out}/summary.json`,JSON.stringify(summary,null,2));}
