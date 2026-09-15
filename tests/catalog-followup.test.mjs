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
test('image provenance URLs never turn uploads into a fictitious last-order condition',()=>{
 const e=entry({evidenceText:'公式画像を確認 公式HTML画像 https://example.com/uploads/2026/05/menu.jpg'});
 const html=renderCatalog(brand,{schemaVersion:1,fairsUpdatedAt:fairs.updatedAt,entries:[e]},fairs,{},now);
 assert.doesNotMatch(html,/loads\/2026/);
});
test('visually reviewed dish names require both the actual image and original source hash',async()=>{
 const {reviewCatalogImage}=await import('../scripts/catalog-reviewed-images.mjs');
 const c={title:'元の見出し',image:{imageUrl:'https://www.jukusei-ichiban.jp/jp/img/top/mainVisual/nib_gland_02_202604_pc.jpg'}};
 assert.equal(reviewCatalogImage(c,'https://www.jukusei-ichiban.jp/jp/','changed').title,c.title);
 const exact=reviewCatalogImage(c,'https://www.jukusei-ichiban.jp/jp/','28ea10907550270e10f8eb763fa835497b55859454cb667e896d7232dbce0fdc');
 assert.equal(exact.title,'特製たれ漬け 骨付きカルビ');assert.equal(exact.exclusive,false);assert.equal(exact.courses.length,3);
});
test('Asakuma parses the actual lunch price, not allergy facts or a universal salad-bar inclusion',()=>{
 const {items}=extractCatalogPage(doc('<h1>おすすめ平日ランチ サラダバー付</h1><div class="box_menu"><p class="ttl_menu">テストハンバーグ</p><p>1,750円（税込1,925円）</p></div><div id="shop">対象店舗 岡崎店</div>'),'https://example.com/menu_recommended-lunch-menu.html',{...brand,id:'asakuma'});
 assert.equal(items.length,1);assert.equal(items[0].price.amount,1925);assert.ok(items[0].conditions.some(x=>x.includes('岡崎店')));
});
test('Stamina time-band menu buttons and dinner signature dishes are not missed',()=>{
 const {items}=extractCatalogPage(doc('<div class="menu-toggle-btn">平日ランチ</div><div class="menu-toggle-btn">ディナー&amp;土日祝ランチ</div><div class="menu-card"><p class="m-yasumi">牛タン ※加工肉です。大垣店対象外。</p></div>'),'https://example.com/menu/',{...brand,id:'stamina-taro'});
 assert.equal(items.filter(e=>e.kind==='course').length,2);const dish=items.find(e=>e.kind==='highlight');assert.equal(dish.title,'牛タン');assert.equal(dish.exclusive,false);assert.ok(dish.conditions.some(x=>x.includes('加工肉')));
});

test('a salad-bar included price cannot look identical to a main-dish-only price',async()=>{
 const {reviewCatalogImage}=await import('../scripts/catalog-reviewed-images.mjs');
 const a=reviewCatalogImage({title:'ランチ',priceEvidence:'サラダバー付 税込1925円'},'https://example.com/','hash');
 const b=reviewCatalogImage({title:'ランチ',priceEvidence:'サラダバー別 税込1155円'},'https://example.com/','hash');
 assert.match(a.title,/サラダバー付/);assert.match(b.title,/サラダバー別/);assert.notEqual(a.title,b.title);
});
