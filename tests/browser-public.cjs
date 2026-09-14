const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const base=process.env.PAGE_URL;
  assert.ok(base?.startsWith('https://longchanp7-hub.github.io/meat-fair-app/'));
  const {campaignStatus}=await import(pathToFileURL(path.resolve('app/status.mjs')));
  const fairs=JSON.parse(await fs.readFile('app/data/fairs.json','utf8'));
  const brandIds=JSON.parse(await fs.readFile('app/data/brands.json','utf8')).brands.map(b=>b.id);
  const stores=JSON.parse(await fs.readFile('app/data/stores.json','utf8'));
  assert.equal(new Set(stores.stores.map(s=>s.brandId)).size,15,'store registry must cover all brands');
  await fs.mkdir('browser-report',{recursive:true});
  const browser=await chromium.launch({headless:true});
  const reports=[];
  try{
    for(const width of [390,1180]){
      const page=await browser.newPage({viewport:{width,height:920},timezoneId:'America/Los_Angeles'});
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      const tabs={};
      await page.goto(base+'?release='+Date.now(),{waitUntil:'domcontentloaded'});
      await page.locator('body[data-ready="true"]').waitFor({timeout:30000});
      assert.equal(await page.locator('.brand').count(),15);
      const publicData=await page.evaluate(async()=>await (await fetch('./data/fairs.json',{cache:'no-cache'})).json());
      assert.equal(publicData.updatedAt,fairs.updatedAt,'browser data is stale');
      for(const tab of ['active','upcoming','ending','new']){
        await page.locator(`button[data-tab="${tab}"]`).click();
        const expected=fairs.campaigns.filter(c=>{
          if(!['P1','P2'].includes(c.priority))return false;
          const s=campaignStatus(c);
          return tab==='new'?s.isNew&&s.state!=='ended':tab==='ending'?s.endingSoon:s.state===tab;
        }).map(c=>c.id).sort();
        const shown=await page.locator('[data-campaign]').evaluateAll(els=>els.map(e=>e.dataset.campaign).sort());
        assert.deepEqual(shown,expected,`wrong ${tab} campaigns at ${width}px`);
        const cards=await page.locator('[data-brand-card]').evaluateAll(els=>els.map(e=>e.dataset.brandCard));
        assert.equal(new Set(cards).size,cards.length,'duplicate brand cards');
        if(tab==='active')assert.deepEqual([...cards].sort(),[...brandIds].sort());
        const images=page.locator('.gallery img'),imageCount=await images.count();
        for(const image of await images.all()){
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(img=>img.decode());
          assert.ok(await image.evaluate(img=>img.naturalWidth>0&&getComputedStyle(img).objectFit==='contain'));
          assert.ok(await image.evaluate(img=>{
            const r=img.getBoundingClientRect(),g=img.closest('.gallery').getBoundingClientRect();
            return r.top>=g.top-1&&r.bottom<=g.bottom+1&&r.left>=g.left-1&&r.right<=g.right+1;
          }),'the visible gallery clips the image despite object-fit:contain');
        }
        assert.equal(await page.locator('.image-unavailable').count(),0,'image request failed');
        assert.equal(await page.locator('.brand-official').count(),cards.length,'repeated official-site buttons');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
        tabs[tab]={cards:cards.length,campaigns:shown.length,images:imageCount};
      }
      await page.locator('button[data-tab="active"]').click();
      for(const id of brandIds){
        await page.locator(`button[data-brand="${id}"]`).click();
        assert.equal(await page.locator('[data-brand-card]').count(),1);
        assert.equal(await page.locator('[data-brand-card]').getAttribute('data-brand-card'),id);
        const cardWidth=await page.locator('[data-brand-card]').evaluate(el=>el.getBoundingClientRect().width);
        const minimum=width<760?width-24:width-64;
        assert.ok(cardWidth>=minimum,`brand card wastes too much horizontal space for ${id}: ${cardWidth}px at ${width}px`);
        assert.equal(await page.locator('.brand-availability').count(),1,`missing local availability for ${id}`);
        assert.ok(await page.locator('.brand-availability .area-chip').count()>0,`missing local area chips for ${id}`);
        for(const image of await page.locator('.gallery img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());}
        if(id==='syabuyo'){
          const promo=await page.locator('.gallery-1').evaluate(g=>`${getComputedStyle(g,'::before').content} ${getComputedStyle(g,'::after').content}`);
          assert.match(promo,/九州黒豚/,'Shabu-yo should use its current Kyushu Kurobuta highlight');
          assert.match(promo,/黒毛和牛/,'Shabu-yo should use its current Kuroge Wagyu highlight');
        }
        if(id==='asakuma'){
          const stats=await page.locator('.gallery-2').evaluateAll(gs=>gs.map(g=>{
            const r=g.getBoundingClientRect();
            const imgs=[...g.querySelectorAll('img')].map(i=>i.getBoundingClientRect());
            return{h:r.height,images:imgs.map(x=>({top:x.top,bottom:x.bottom,height:x.height,left:x.left,right:x.right}))};
          }));
          assert.ok(stats.every(s=>s.images.length===2),'Asakuma should show both current official posters');
          if(width<760){
            assert.ok(stats.every(s=>s.images[1].top>=s.images[0].bottom-1),`Asakuma posters should stack vertically at ${width}px`);
            assert.ok(stats.every(s=>s.h<=s.images[0].height+s.images[1].height+12),`Asakuma stacked gallery leaves an unnecessary vertical band at ${width}px`);
          }else{
            assert.ok(stats.every(s=>Math.abs(s.images[0].top-s.images[1].top)<=1),`Asakuma posters should remain side-by-side on wide screens at ${width}px`);
            assert.ok(stats.every(s=>s.h<=Math.max(...s.images.map(i=>i.height))+6),`Asakuma wide gallery leaves a fixed-height vertical band at ${width}px`);
          }
        }
        if(['gyukaku','syabuyo','asakuma','nikusho-sakai','washoku-sato','roan','kushiya-monogatari'].includes(id)){
          await page.screenshot({path:`browser-report/${width}-${id}.png`,fullPage:true});
        }
        const h=fairs.sourceHealth.find(h=>h.brandId===id);
        if(h.status==='unavailable')assert.match(await page.locator('.empty-brand').innerText(),/「フェアなし」とは判断していません/);
        await page.locator('#clear-filter').click();
      }
      assert.deepEqual(errors,[]);
      reports.push({width,tabs,errors});await page.close();
    }
    await fs.writeFile('browser-report/result.json',JSON.stringify({passed:true,verifiedAt:new Date().toISOString(),updatedAt:fairs.updatedAt,reports},null,2));
    console.log(JSON.stringify({passed:true,reports},null,2));
  }catch(e){
    await fs.writeFile('browser-report/result.json',JSON.stringify({passed:false,error:String(e),reports},null,2));
    throw e;
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
