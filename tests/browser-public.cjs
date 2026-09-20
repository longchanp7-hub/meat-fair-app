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
  const brandIds=new Set(brands.map(b=>b.id));
  assert.equal(brands.length,14);assert.equal(brandIds.has('kushiya-monogatari'),false);
  assert.equal(new Set(stores.stores.map(s=>s.brandId)).size,brands.length);
  assert.ok(stores.stores.every(s=>brandIds.has(s.brandId)));
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
    assert.equal(await page.locator('[data-brand="kushiya-monogatari"]').count(),0,'removed Kushiya remains in selector');
    assert.equal(await page.locator('#brand-grid .brand').count(),brands.length,'selector count differs from target brands');
    assert.ok(await page.locator('.featured-mark').count()>0,'notable fairs are not marked in selector');
    const expectedRows=tab=>fairs.campaigns.filter(c=>brandIds.has(c.brandId)).filter(c=>{
      if(!['P1','P2'].includes(c.priority))return false;const s=campaignStatus(c);
      return tab==='new'?s.isNew&&s.state!=='ended':tab==='ending'?s.endingSoon:s.state===tab;
    });
    const settle=(p=page)=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    async function inspect(p=page){
      await p.locator('.adaptive-gallery img').evaluateAll(images=>images.forEach(i=>i.loading='eager'));
      await p.waitForFunction(()=>[...document.querySelectorAll('.adaptive-gallery img')].every(i=>i.complete),{},{timeout:20000});
      await p.locator('.adaptive-gallery img').evaluateAll(images=>Promise.all(images.map(i=>i.decode().catch(()=>{}))));
      await settle(p);
      const faults=await p.locator('.adaptive-gallery').evaluateAll(gs=>{
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
            const caption=t.querySelector('.media-caption'),cr=caption.getBoundingClientRect();
            if(cr.top<ir.bottom-1||cr.bottom>r.bottom+1)out.push('caption overlaps or clips');
            for(const child of caption.children){const c=child.getBoundingClientRect();if(c.top<cr.top-1||c.bottom>cr.bottom+1)out.push('caption text vertically clipped');}
            const price=t.querySelector('.media-price');if(price&&price.scrollWidth>price.clientWidth+1)out.push('tax-inclusive price clipped');
            for(let j=i+1;j<rects.length;j++){const b=rects[j];if(Math.min(r.right,b.right)-Math.max(r.left,b.left)>1&&Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>1)out.push('tile overlap');}
          }
          if(rects.length&&Math.abs(Math.max(...rects.map(r=>r.bottom))-gr.bottom)>1)out.push('empty bottom band');
        }
        return out;
      });
      assert.deepEqual(faults,[]);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
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
        assert.equal(await page.locator('[data-brand-card]').count(),brands.length);await inspect();
        for(const id of ['syabuyo','asakuma','washoku-sato','nikusho-sakai'])await screenshotCard(id,width);
        reports.push({width,layoutBrands:brands.length,images:await page.locator('.media-tile').count(),imageFallbacks:await page.locator('.media-unavailable').count()});
        console.log('Layout width passed:',width);continue;
      }
      for(const tab of ['active','upcoming','ending','new']){
        await page.locator(`[data-tab="${tab}"]`).click();
        const expected=expectedRows(tab),shown=await page.locator('[data-campaign]').evaluateAll(es=>es.map(e=>e.dataset.campaign).sort());
        assert.deepEqual(shown,expected.map(c=>c.id).sort());
        const ids=await page.locator('[data-brand-card]').evaluateAll(es=>es.map(e=>e.dataset.brandCard));
        assert.equal(new Set(ids).size,ids.length);if(tab==='active')assert.equal(ids.length,brands.length);
        await inspect();assert.equal(await page.locator('.brand-official').count(),ids.length);
        if(tab==='active'){
          assert.equal(await page.locator('[data-catalog-section="course"]').count(),brands.length,'missing course section');
          assert.equal(await page.locator('[data-catalog-section="drink"]').count(),brands.length,'missing drink section');
          assert.equal(await page.locator('#brand-grid').innerText().then(t=>/\d+件/.test(t)),false,'fair counts remain in chain selector');
          assert.equal(await page.locator('.restaurant-head').allInnerTexts().then(ts=>ts.some(t=>/\d+件/.test(t))),false,'fair counts remain in card headings');
          assert.equal(await page.locator('[data-catalog-section="highlight"]').count(),0,'highlight menu section remains');
          const shabuyoExtras=await page.locator('[data-brand-card="syabuyo"] [data-gallery-role="fair"] .media-tile[data-kind="detail"]').allInnerTexts();
          assert.ok(shabuyoExtras.every(t=>/九州黒豚|黒毛和牛/.test(t)),'Shabuyo individual dishes leaked into compact gallery');
        }
        tabs[tab]={brands:ids.length,campaigns:shown.length,images:await page.locator('.adaptive-gallery img').count(),imageFallbacks:await page.locator('.media-unavailable').count()};
      }
      await page.locator('[data-tab="active"]').click();
      for(const brand of brands){
        await page.locator(`[data-brand="${brand.id}"]`).click();
        const card=page.locator('[data-brand-card]');assert.equal(await card.count(),1);assert.equal(await card.getAttribute('data-brand-card'),brand.id);
        const crows=expectedRows('active').filter(c=>c.brandId===brand.id),expectedCount=selectMedia(crows,brand.id,media,'active').length;
        await inspect();
        assert.equal(await page.locator('[data-gallery-role="fair"] .media-tile,[data-gallery-role="fair"] .media-unavailable').count(),expectedCount,'missing or fictitious image');
        assert.equal(await page.locator('.brand-availability,.local-note').count(),1,'missing availability explanation');
        if(brand.id==='nikusho-sakai'){
          const photoIds=await page.locator('.catalog-photo-card').evaluateAll(es=>es.map(e=>e.dataset.catalogId));
          const textIds=await page.locator('.compact-card').evaluateAll(es=>es.map(e=>e.dataset.catalogId));
          assert.ok(photoIds.length>0,'Sakai lost its photo-backed course/drink cards');
          assert.ok(photoIds.every(id=>!textIds.includes(id)),'Sakai photo card is duplicated by a text card');
          if(width===390){const rects=await page.locator('[data-photo-stack="course"] .catalog-photo-card').evaluateAll(es=>es.map(e=>e.getBoundingClientRect()).map(r=>({x:r.x,y:r.y,w:r.width,h:r.height})));for(let i=1;i<rects.length;i++)assert.ok(rects[i].y>=rects[i-1].y+rects[i-1].h-1,'Sakai phone course cards are not vertically stacked');}
        }
        if(brand.id==='jukusei-ichiban'&&width===390){const heights=await page.locator('[data-photo-stack="course"] .catalog-photo-frame').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));if(heights.length>1)assert.ok(Math.max(...heights)-Math.min(...heights)<2,'Ichiban course image frames have inconsistent size');}
        await screenshotCard(brand.id,width);
        await page.locator('#clear-filter').click();
      }
      await inspect();
      const geometry=await page.locator('[data-brand-card]').evaluateAll(cards=>cards.map(card=>({brandId:card.dataset.brandCard,campaigns:card.querySelectorAll('[data-campaign]').length,images:[...card.querySelectorAll('[data-gallery-role="fair"] .media-tile')].map(t=>{const r=t.getBoundingClientRect(),ir=t.querySelector('img').getBoundingClientRect();return{title:t.title,kind:t.dataset.kind,group:t.dataset.group,x:r.x,y:r.y,width:r.width,height:r.height,imageHeight:ir.height};})})));
      await fs.writeFile(`${folder}/${width}-geometry.json`,JSON.stringify(geometry,null,2));
      await page.screenshot({path:`${folder}/${width}-all.png`,fullPage:true});
      reports.push({width,tabs});console.log('All tabs and brand filters passed:',width);
    }
    await page.setViewportSize({width:390,height:900});
    for(const percent of [125,150,200]){await page.evaluate(p=>document.documentElement.style.fontSize=p+'%',percent);await inspect();reports.push({width:390,textSizePercent:percent,captionAndPriceClipping:false});}
    await page.evaluate(()=>document.documentElement.style.fontSize='');await inspect();
    await page.locator('[data-brand="syabuyo"]').click();await inspect();
    const before=await page.locator('.media-tile').count();assert.ok(before>0);
    await page.locator('.media-tile img').first().evaluate(i=>i.dispatchEvent(new Event('error')));await settle();
    assert.equal(await page.locator('.media-tile').count(),before-1);assert.ok(await page.locator('.media-unavailable').count()>0);await inspect();
    await page.locator('#clear-filter').click();
    const liveChanges=await require('./gallery-live-resize.cjs')({page,inspect,settle});reports.push({liveChanges});console.log('Image-count changes and live Fold resizing passed:',JSON.stringify(liveChanges));
    const lifecyclePage=await browser.newPage({viewport:{width:390,height:900},timezoneId:'America/Los_Angeles',serviceWorkers:'block'});
    lifecyclePage.setDefaultTimeout(12000);await lifecyclePage.emulateMedia({reducedMotion:'reduce'});
    await lifecyclePage.goto(base+'?lifecycle='+Date.now(),{waitUntil:'domcontentloaded'});
    await lifecyclePage.locator('body[data-ready="true"]').waitFor({timeout:30000});
    const refreshLifecycle=await require('./refresh-lifecycle.cjs')({
      page:lifecyclePage,
      inspect:()=>inspect(lifecyclePage),
      settle:()=>settle(lifecyclePage)
    });
    await lifecyclePage.close();
    reports.push({refreshLifecycle});console.log('Foreground data lifecycle passed:',JSON.stringify(refreshLifecycle));
    const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel="manifest"]').href)).json());
    assert.equal(manifest.id,'/meat-fair-app/');assert.equal(manifest.start_url,manifest.id);assert.equal(manifest.scope,manifest.id);assert.equal(manifest.display,'standalone');
    const scope=await page.evaluate(async()=>(await navigator.serviceWorker.ready).scope);assert.equal(new URL(scope).pathname,'/meat-fair-app/');
    assert.deepEqual(errors,[]);
    await fs.writeFile(`${folder}/result.json`,JSON.stringify({passed:true,verifiedAt:new Date().toISOString(),reports,pwaScope:scope,errors},null,2));
    console.log(JSON.stringify({passed:true,reports,pwaScope:scope,errors},null,2));await page.close();
  }catch(e){await fs.writeFile(`${folder}/result.json`,JSON.stringify({passed:false,error:String(e),reports},null,2));throw e;}
  finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
