/* Browser-only responses exercise the real foreground-refresh path. Production
 * files are never edited and no synthetic data is sent to the public server. */
const assert=require('node:assert/strict');
module.exports=async function checkRefreshLifecycle({page,inspect,settle}){
  const original=await page.evaluate(async()=>({
    fairs:await(await fetch('./data/fairs.json',{cache:'no-cache'})).json(),
    media:await(await fetch('./data/gallery.json',{cache:'no-cache'})).json()
  }));
  const brandId='syabuyo',card=`[data-brand-card="${brandId}"]`;
  await page.locator('[data-tab="active"]').click();
  const clear=page.locator('#clear-filter');if(await clear.isVisible())await clear.click();
  await page.setViewportSize({width:390,height:900});
  await page.locator(`[data-brand="${brandId}"]`).click();await inspect();
  const originalImages=await page.locator(card+' .media-tile').count();
  const originalRows=await page.locator(card+' [data-campaign]').count();
  assert.ok(originalRows>0&&originalImages>1,'current official fair required');
  const courses=page.locator(card+' [data-group="course"]'),meals=page.locator(card+' [data-group="related-meal"]');
  if(originalRows===1&&await courses.count()===2&&await meals.count()===2){
    const lead=await page.locator(card+' .media-tile[data-kind="campaign"]').first().boundingBox();
    assert.ok(lead.width>=175,'portrait fair lead became too small');
  }
  let next=original.fairs,failGallery=false;
  const fairRoute=route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(next)});
  const mediaRoute=route=>failGallery?route.fulfill({status:503,contentType:'text/plain',body:'test-only temporary unavailability'}):route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(original.media)});
  const fairPattern='**/meat-fair-app/data/fairs.json',mediaPattern='**/meat-fair-app/data/gallery.json';
  await page.route(fairPattern,fairRoute);await page.route(mediaPattern,mediaRoute);
  await page.evaluate(()=>{window.__refreshClock={native:Date.now,offset:0};Date.now=()=>window.__refreshClock.native()+window.__refreshClock.offset;});
  const foreground=async()=>{
    const responses=Promise.all([page.waitForResponse(r=>r.url().endsWith('/data/fairs.json')),page.waitForResponse(r=>r.url().endsWith('/data/gallery.json'))]);
    await page.evaluate(()=>{window.__refreshClock.offset+=61001;window.dispatchEvent(new Event('pageshow'));});
    await responses;await settle();
  };
  try{
    // A new fair feed arrives while gallery retrieval fails: the old gallery must
    // not retain either removed-parent dishes or formerly attached menu banners.
    next={...original.fairs,updatedAt:new Date().toISOString(),campaigns:original.fairs.campaigns.filter(c=>c.brandId!==brandId)};failGallery=true;
    await foreground();
    await page.waitForFunction(s=>document.querySelectorAll(s+' [data-campaign]').length===0,card);await inspect();
    assert.equal(await page.locator(card+' .media-tile').count(),0,'removed fair retained stale supplementary images');
    assert.equal(await page.locator('[data-brand-card]').count(),1,'refresh lost brand filter');
    assert.equal(await page.locator(card+' .adaptive-gallery').count(),0,'removed fair left an empty gallery');
    // Same ID with a new evidence hash must not inherit old details or menus.
    next={...original.fairs,updatedAt:new Date(Date.now()+1).toISOString(),campaigns:original.fairs.campaigns.map(c=>c.brandId===brandId?{...c,contentHash:c.contentHash+'-browser-fixture'}:c)};
    await foreground();
    await page.waitForFunction(({s,n})=>document.querySelectorAll(s+' [data-campaign]').length===n,{s:card,n:originalRows});await inspect();
    assert.equal(await page.locator(card+' .media-tile:not([data-kind="campaign"])').count(),0,'changed evidence retained supplementary assets');
    // Successful retrieval restores the real, unmodified official data in place.
    next={...original.fairs,updatedAt:new Date(Date.now()+2).toISOString()};failGallery=false;await foreground();
    await page.waitForFunction(({s,n})=>document.querySelectorAll(s+' .media-tile').length===n,{s:card,n:originalImages});await inspect();
    assert.equal(await page.locator(card+' [data-campaign]').count(),originalRows);
    return{passed:true,removedParentWithGalleryFailure:true,changedParentHash:true,restoredWithoutReload:true,brandFilterPreserved:true,originalImages};
  }finally{
    await page.unroute(fairPattern,fairRoute);await page.unroute(mediaPattern,mediaRoute);
    await page.evaluate(()=>{Date.now=window.__refreshClock.native;delete window.__refreshClock;});
    if(await clear.isVisible())await clear.click();
  }
};
