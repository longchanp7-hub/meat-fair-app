import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {catalogEntryCurrent,selectCatalog,groupCoursePrices,renderCatalog} from '../app/catalog.mjs';
import {extractCatalogPage} from '../scripts/catalog-extract.mjs';
const now=new Date('2026-09-15T02:00:00Z');
const brand={id:'test',name:'テスト',homeUrl:'https://example.com/brand/'};
const doc=s=>`<html><body><main>${s}<p>詳細は公式メニューをご確認ください。店舗により提供内容が異なります。</p></main></body></html>`;
const entry=(extra={})=>({id:'x',brandId:'test',kind:'course',title:'通常コース',sourceUrl:brand.homeUrl,officialUrl:brand.homeUrl,checkedAt:now.toISOString(),sourceHash:'source',evidenceText:'公式税込3,300円',price:{amount:3300,text:'税込3,300円',taxIncluded:true},context:{service:'ディナー',days:'平日',audience:'大人'},comparisonKey:'weekday-adult-dinner',conditions:[],targetCourses:[],...extra});
const fairs={updatedAt:'generation2',campaigns:[{id:'c',brandId:'test',contentHash:'h',startDate:'2026-09-01',endDate:'2026-09-30'}]};
test('independent menus survive an unrelated fair ending but expire in 48 hours',()=>{
 assert.equal(catalogEntryCurrent(entry(),{...fairs,campaigns:[]},now,false),true);
 assert.equal(catalogEntryCurrent(entry({checkedAt:'2026-09-12T00:00:00Z'}),fairs,now),false);
 assert.equal(catalogEntryCurrent(entry({checkedAt:'2026-09-16T00:00:00Z'}),fairs,now),false);
});
test('fair-bound menus require the live parent hash and a coherent generation',()=>{
 const e=entry({campaignId:'c',parentHash:'h'});
 assert.equal(catalogEntryCurrent(e,fairs,now),true);
 assert.equal(catalogEntryCurrent(e,fairs,now,false),false);
 assert.equal(catalogEntryCurrent({...e,parentHash:'changed'},fairs,now),false);
 assert.equal(catalogEntryCurrent(e,{...fairs,campaigns:[]},now),false);
});
test('a mixed deployment uses only bounded independently verified last-known-good catalog entries',()=>{
 const rows=selectCatalog({schemaVersion:1,fairsUpdatedAt:'generation1',entries:[entry(),entry({id:'child',campaignId:'c',parentHash:'h'})]},'test',fairs,now);
 assert.equal(rows.length,1);assert.equal(rows[0].verificationState,'last_known_good');
});
test('price ordering never compares different people, meals or charge categories',()=>{
 const a=entry({id:'a',price:{amount:5000,taxIncluded:true}}),b=entry({id:'b',price:{amount:3000,taxIncluded:true}}),c=entry({id:'c',comparisonKey:'child-lunch',price:{amount:1000,taxIncluded:true},context:{service:'ランチ',days:'平日',audience:'小学生'}});
 const groups=groupCoursePrices([a,c,b]);assert.deepEqual(groups[0].map(e=>e.id),['b','a']);assert.equal(groups[1][0].id,'c');
 const unknown=groupCoursePrices([entry({id:'u',context:{}}),entry({id:'v',context:{}})]);assert.equal(unknown.length,2);
});
test('every brand has visible course and drink sections, without inventing an unknown plan',()=>{
 const html=renderCatalog(brand,{schemaVersion:1,fairsUpdatedAt:fairs.updatedAt,entries:[]},fairs,{},now);
 assert.match(html,/data-catalog-section="course"/);assert.match(html,/data-catalog-section="drink"/);assert.match(html,/プランの有無・料金/);assert.doesNotMatch(html,/開催中\d+件/);
});
test('explicitly included drinks can display zero/free without being treated as unknown',()=>{
 const html=renderCatalog(brand,{schemaVersion:1,fairsUpdatedAt:fairs.updatedAt,entries:[entry({kind:'drink',title:'ドリンクバー',price:{amount:0,text:'食事に含まれます',taxIncluded:true}})]},fairs,{},now);
 assert.match(html,/食事に含まれます/);assert.doesNotMatch(html,/税込0円/);
});
test('the menu renderer escapes untrusted official text and link attributes',()=>{
 const html=renderCatalog(brand,{schemaVersion:1,fairsUpdatedAt:fairs.updatedAt,entries:[entry({title:'<script>alert(1)</script>',officialUrl:'javascript:alert(1)'})]},fairs,{},now);
 assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/href="javascript:/);
});
test('the chain selector and card header no longer publish fair counts',async()=>{
 const code=await fs.readFile(new URL('../app/app.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/開催中\$\{.*?\}件|class="fair-count"|class="counts"/);
});
test('58-item course names remain intact and are not mistaken for a price',()=>{
 const b={...brand,id:'yakiniku-king'};
 const html=doc('<header class="c-pageHeader"><div class="c-pageHeader--detail"><h1 class="c-pageHeader--heading">58品コース</h1><div class="c-pageHeader--price">税込3,278円〜</div></div></header>');
 const result=extractCatalogPage(html,'https://example.com/menu_all/free3/',b);
 assert.equal(result.items[0].title,'58品コース');assert.equal(result.items[0].price.amount,3278);
});
test('normal and Plus course prices have separate comparison scopes',()=>{
 const b={...brand,id:'amiyakitei'};
 const html=doc('<div class="brand-content"><div class="course-slider__item"><h4 class="course-slider__title">国産黒毛和牛 食べ放題コース</h4><p>税込4,500円</p></div></div><div class="brand-content"><div id="course-plus"></div><div class="course-slider__item"><h4 class="course-slider__title">黒毛和牛堪能コース</h4><p>税込4,488円</p></div></div>');
 const {items}=extractCatalogPage(html,'https://example.com/menu/',b);
 assert.equal(items.length,2);assert.notEqual(items[0].comparisonKey,items[1].comparisonKey);assert.equal(items[1].context.subBrand,'あみやき亭Plus');
});
test('image-only prices are never taken from filename numbers, including decomposed Japanese Unicode',()=>{
 const b={...brand,id:'nikusho-sakai'};
 const html=doc('<a href="/p.jpg"><img src="/肉匠坂井スペシャルコース_表面_3980.jpg" width="1800" height="1200"></a>');
 const {items}=extractCatalogPage(html,'https://example.com/menu/',b);
 assert.equal(items.length,1);assert.equal(items[0].title,'肉匠坂井スペシャルコース');assert.equal(items[0].price.amount,null);assert.ok(items[0].imageUrl);
});
test('a franchise link does not become a lunch course',()=>{
 const {items}=extractCatalogPage(doc('<h3>フランチャイズ加盟店募集</h3><img src="/franchise.jpg" alt="フランチャイズ加盟店募集" width="900" height="600">'),'https://example.com/',{...brand,id:'kushiya-monogatari'});
 assert.equal(items.length,0);
});
test('Ichiban pairs each course price with its actual official content panel',()=>{
 const html=doc('<a href="#tab1"><section><div class="box"><h3 class="productName">牛タン食べ放題コース</h3><p>税込4,378円</p></div></section></a><ul id="cate1"><li><img src="/verified-menu.jpg" alt="牛タン食べ放題コース" width="900" height="1300"></li></ul>');
 const {items}=extractCatalogPage(html,'https://example.com/jp/menu/',{...brand,id:'jukusei-ichiban'});
 assert.equal(items.length,1);assert.equal(items[0].price.amount,4378);assert.equal(items[0].imageUrl,'https://example.com/verified-menu.jpg');
});
test('an image-only alcohol plan is not removed merely because a soft drink plan has a known price',async()=>{
 const {dedupCatalog}=await import('../scripts/catalog-extract.mjs');
 const rows=dedupCatalog([entry({kind:'drink',title:'飲み放題',price:{amount:null}}),entry({id:'soft',kind:'drink',title:'ドリンクバー',price:{amount:385,taxIncluded:true}})]);
 assert.equal(rows.length,2);
});
