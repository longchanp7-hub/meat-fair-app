const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const path=require('node:path');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  let base=process.env.PAGE_URL,server;
  if(!base){
    server=http.createServer(async(req,res)=>{
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/meat-fair-app\//,'');
      const file=path.resolve('app',name||'index.html');
      if(!file.startsWith(path.resolve('app')+path.sep)){res.writeHead(403);return res.end();}
      try{const bytes=await fs.readFile(file);const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/meat-fair-app/`;
  }else assert.ok(base.startsWith('https://longchanp7-hub.github.io/meat-fair-app/'));
  const {campaignStatus}=await import(pathToFileURL(path.resolve('app/status.mjs')));
  const {selectMedia}=await import(pathToFileURL(path.resolve('app/gallery.mjs')));
  const fairs=JSON.parse(await fs.readFile('app/data/fairs.json','utf8'));
  const media=JSON.parse(await fs.readFile('app/data/gallery.json','utf8'));
  const brands=JSON.parse(await fs.readFile('app/data/brands.json','utf8')).brands;
  const stores=JSON.parse(await fs.readFile('app/data/stores.json','utf8'));
  assert.equal(new Set(stores.stores.map(s=>s.brandId)).size,15);
  const folder='browser-report';await fs.mkdir(folder,{recursive:true});
  const browser=await chromium.launch({headless:true});const reports=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:900},timezoneId:'America/Los_Angeles'});
    page.setDefaultTimeout(12000);await page.emulateMedia({reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base+'?release='+Date.now(),{waitUntil:'domcontentloaded'});
    await page.locator('body[data-ready="true"]').waitFor({timeout:30000});
    const received=await page.evaluate(async()=>await(await fetch('./data/fairs.json',{cache:'no-cache'})).json());
    assert.equal(received.updatedAt,fairs.updatedAt,'stale public data');
    const expectedRows=tab=>fairs.campaigns.filter(c=>{
      if(!['P1','P2'].includes(c.priority))return false;const s=campaignStatus(c);
      return tab==='new'?s.isNew&&s.state!=='ended':tab==='ending'?s.endingSoon:s.state===tab;
    });
    const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    async function inspect(){
      await page.locator('.adaptive-gallery img').evaluateAll(images=>images.forEach(i=>i.loading='eager'));
      await page.waitForFunction(()=>[...document.querySelectorAll('.adaptive-gallery img')].every(i=>i.complete),{},{timeout:20000});
      await page.locator('.adaptive-gallery img').evaluateAll(images=>Promise.all(images.map(i=>i.decode().catch(()=>{}))));
      await settle();
      const faults=await page.locator('.adaptive-gallery').evaluateAll(gs=>{
        const out=[];
        for(const g of gs){
          const gr=g.getBoundingClientRect(),tiles=[...g.querySelectorAll('.media-tile')];
          const rects=tiles.map(t=>t.getBoundingClientRect());
          for(const [i,t]of tiles.entries()){
            const r=rects[i],img=t.querySelector('img'),ir=img.getBoundingClientRect();
            if(!img.complete||!img.naturalWidth)out.push('image not loaded');
            if(getComputedStyle(img).objectFit!=='contain')out.push('image cropped');
            if(img.naturalWidth&&Math.abs(ir.width/ir.height-img.naturalWidth/img.naturalHeight)>.015)out.push('wrong aspect ratio');
            if(r.left<gr.left-1||r.right>gr.right+1||r.top<gr.top-1||r.bottom>gr.bottom+1)out.push('tile overflow');
            for(let j=i+1;j<rects.length;j++){const b=rects[j];if(Math.min(r.right,b.right)-Math.max(r.left,b.left)>1&&Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>1)out.push('tile overlap');}
          }
          if(rects.length&&Math.abs(Math.max(...rects.map(r=>r.bottom))-gr.bottom)>1)out.push('empty bottom band');
        }
        return out;
      });
      assert.deepEqual(faults,[]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
    }
    async function screenshotCard(id,width){
      await page.locator('#status-tabs').evaluate(e=>e.style.visibility='hidden');
      try{await page.locator(`[data-brand-card="${id}"]`).screenshot({path:`${folder}/${width}-${id}.png`});}
      finally{await page.locator('#status-tabs').evaluate(e=>e.style.visibility='');}
    }
    for(const width of [360,390,430,690,820,1024]){
      await page.setViewportSize({width,height:900});
      const tabs={};
      if(![390,820].includes(width)){
        await page.locator('[data-tab="active"]').click();
        assert.equal(await page.locator('[data-brand-card]').count(),15);await inspect();
        for(const id of ['syabuyo','asakuma','washoku-sato'])await screenshotCard(id,width);
        reports.push({width,layoutBrands:15,images:await page.locator('.media-tile').count(),imageFallbacks:await page.locator('.media-unavailable').count()});
        console.log('Layout width passed:',width);continue;
      }
      for(const tab of ['active','upcoming','ending','new']){
        await page.locator(`[data-tab="${tab}"]`).click();
        const expected=expectedRows(tab),shown=await page.locator('[data-campaign]').evaluateAll(es=>es.map(e=>e.dataset.campaign).sort());
        assert.deepEqual(shown,expected.map(c=>c.id).sort());
        const ids=await page.locator('[data-brand-card]').evaluateAll(es=>es.map(e=>e.dataset.brandCard));
        assert.equal(new Set(ids).size,ids.length);if(tab==='active')assert.equal(ids.length,15);
        await inspect();assert.equal(await page.locator('.brand-official').count(),ids.length);
        tabs[tab]={brands:ids.length,campaigns:shown.length,images:await page.locator('.adaptive-gallery img').count(),imageFallbacks:await page.locator('.media-unavailable').count()};
      }
      await page.locator('[data-tab="active"]').click();
      for(const brand of brands){
        await page.locator(`[data-brand="${brand.id}"]`).click();
        const card=page.locator('[data-brand-card]');assert.equal(await card.count(),1);assert.equal(await card.getAttribute('data-brand-card'),brand.id);
        const crows=expectedRows('active').filter(c=>c.brandId===brand.id),expectedCount=selectMedia(crows,brand.id,media,'active').length;
        await inspect();
        assert.equal(await page.locator('.media-tile,.media-unavailable').count(),expectedCount,'missing or fictitious image');
        assert.equal(await page.locator('.brand-availability,.local-note').count(),1,'missing availability explanation');
        if(['syabuyo','asakuma','washoku-sato'].includes(brand.id))await screenshotCard(brand.id,width);
        await page.locator('#clear-filter').click();
      }
      await inspect();await page.screenshot({path:`${folder}/${width}-all.png`,fullPage:true});
      reports.push({width,tabs});console.log('All tabs and brand filters passed:',width);
    }
    await page.locator('[data-brand="syabuyo"]').click();await inspect();
    const before=await page.locator('.media-tile').count();assert.ok(before>0);
    await page.locator('.media-tile img').first().evaluate(i=>i.dispatchEvent(new Event('error')));await settle();
    assert.equal(await page.locator('.media-tile').count(),before-1);
    assert.ok(await page.locator('.media-unavailable').count()>0);await inspect();
    await page.locator('#clear-filter').click();
    const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel="manifest"]').href)).json());
    assert.equal(manifest.id,'/meat-fair-app/');assert.equal(manifest.start_url,manifest.id);assert.equal(manifest.scope,manifest.id);assert.equal(manifest.display,'standalone');
    const scope=await page.evaluate(async()=>(await navigator.serviceWorker.ready).scope);assert.equal(new URL(scope).pathname,'/meat-fair-app/');
    assert.deepEqual(errors,[]);
    await fs.writeFile(`${folder}/result.json`,JSON.stringify({passed:true,verifiedAt:new Date().toISOString(),reports,pwaScope:scope,errors},null,2));
    console.log(JSON.stringify({passed:true,reports,pwaScope:scope,errors},null,2));await page.close();
  }catch(e){await fs.writeFile(`${folder}/result.json`,JSON.stringify({passed:false,error:String(e),reports},null,2));throw e;}
  finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
