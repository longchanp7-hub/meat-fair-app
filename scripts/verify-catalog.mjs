import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {contentHash} from './catalog-extract.mjs';
import {publicUrl} from './gallery-extract.mjs';
const root=new URL('../app/data/',import.meta.url);
const read=async file=>JSON.parse(await fs.readFile(new URL(file,root),'utf8'));
let data;try{data=await read('catalog.json');}catch(e){if(e.code==='ENOENT'){console.log('Catalog is not generated yet; optional legacy-compatible data');process.exit(0);}throw e;}
const fairs=await read('fairs.json'),gallery=await read('gallery.json'),brands=(await read('brands.json')).brands;
assert.equal(data.schemaVersion,1);assert.equal(data.fairsUpdatedAt,fairs.updatedAt);assert.equal(data.galleryUpdatedAt,gallery.updatedAt);
assert.equal(data.sourceHealth.length,brands.length);assert.equal(new Set(data.sourceHealth.map(s=>s.brandId)).size,brands.length);
const ids=new Set();
for(const e of data.entries){
  assert.ok(!ids.has(e.id),'duplicate catalog ID');ids.add(e.id);
  assert.ok(brands.some(b=>b.id===e.brandId));assert.ok(['course','highlight','drink'].includes(e.kind));
  assert.ok(e.title&&e.evidenceText&&e.sourceHash&&e.checkedAt);assert.ok(!/フランチャイズ|加盟店募集|undefined/.test(e.title+' '+e.officialUrl));assert.equal(e.evidenceHash,contentHash(e.evidenceText));
  assert.ok(publicUrl(e.sourceUrl)&&publicUrl(e.officialUrl));assert.ok(Number.isFinite(Date.parse(e.checkedAt)));
  assert.ok(e.price.amount===null||(Number.isFinite(e.price.amount)&&e.price.amount>=0&&e.price.taxIncluded===true));
  if(e.imageUrl){assert.ok(publicUrl(e.imageUrl));assert.ok(e.width>=320&&e.height>=100);}
  if(e.campaignId)assert.ok(fairs.campaigns.some(c=>c.id===e.campaignId&&c.contentHash===e.parentHash&&c.brandId===e.brandId),'stale catalog parent');
  if(e.exclusive)assert.ok(e.kind==='highlight'&&e.targetCourses.length>0);
}
console.log(JSON.stringify({catalogEntries:data.entries.length,brands:data.sourceHealth.length,warnings:data.errors.length}));
