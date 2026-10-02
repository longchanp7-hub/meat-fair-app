/* Browser-only fixture using the app's actual, verified official image URLs.
 * Nothing is saved to app/data or sent back to the published site.
 */
const assert=require('node:assert/strict');
module.exports=async function checkLiveGallery({page,inspect,settle}){
  const available=await page.evaluate(async()=>{
    const [{selectMedia},{campaignStatus},fairs,media]=await Promise.all([
      import('./gallery.mjs'),import('./status.mjs'),
      fetch('./data/fairs.json',{cache:'no-cache'}).then(r=>r.json()),
      fetch('./data/gallery.json',{cache:'no-cache'}).then(r=>r.json())
    ]);
    const pool=[],seen=new Set();
    for(const brandId of [...new Set(fairs.campaigns.map(c=>c.brandId))]){
      const rows=fairs.campaigns.filter(c=>c.brandId===brandId&&['P1','P2'].includes(c.priority)&&campaignStatus(c).state==='active');
      for(const asset of selectMedia(rows,brandId,media,'active')){
        if(seen.has(asset.imageUrl))continue;seen.add(asset.imageUrl);pool.push(asset);
        if(pool.length>=6)break;
      }
      if(pool.length>=6)break;
    }
    const host=document.createElement('article');host.className='restaurant-card';host.dataset.layoutFixture='true';
    document.querySelector('#campaign-list').append(host);
    window.__layoutFixture={host,pool};
    return pool.length;
  });
  assert.ok(available>=2,'at least two current official images across reviewed brands are required to test count changes');
  const counts=[0,1,2,available,Math.min(3,available),0,available];
  const widths=[360,390,430,690,820,1024,390];
  try{
    for(const [index,count]of counts.entries()){
      await page.setViewportSize({width:widths[index],height:900});
      await page.evaluate(async count=>{
        const {renderGallery,enhanceGalleries}=await import('./gallery.mjs');
        const {host,pool}=window.__layoutFixture;
        const selected=pool.slice(0,count);
        const rows=selected.map((a,i)=>({id:'fixture-'+i,brandId:'fixture',contentHash:'fixture',title:a.title,imageUrl:a.imageUrl,officialUrl:a.officialUrl}));
        const media={assets:selected.map((a,i)=>({...a,brandId:'fixture',campaignId:'fixture-'+i,parentHash:'fixture',kind:'campaign'}))};
        host.innerHTML=renderGallery(rows,{id:'fixture',name:'自動配置の検証'},media,'active');
        enhanceGalleries();
      },count);
      await inspect();
      assert.equal(await page.locator('[data-layout-fixture] .media-tile,[data-layout-fixture] .media-unavailable').count(),count);
      if(!count)assert.equal(await page.locator('[data-layout-fixture] .adaptive-gallery').count(),0,'zero images must leave no empty photo block');
    }
    // A Fold opens and closes while the same DOM and photos remain on screen.
    const foldingWidths=[390,820,390,690,1024,360];
    for(const width of foldingWidths){
      await page.setViewportSize({width,height:900});await settle();await inspect();
      assert.equal(await page.locator('[data-layout-fixture] .media-tile,[data-layout-fixture] .media-unavailable').count(),available);
    }
    return{passed:true,counts,widths,foldingWidths,source:'verified official image URLs'};
  }finally{
    await page.evaluate(async()=>{
      window.__layoutFixture?.host.remove();delete window.__layoutFixture;
      const {enhanceGalleries}=await import('./gallery.mjs');enhanceGalleries();
    });
  }
};
