import test from 'node:test';
import assert from 'node:assert/strict';
import {activeOffers,selectHighlights,selectPromotions,selectFairRows} from '../app/brand-details.mjs';
const now=new Date('2026-09-15T09:00:00+09:00');

test('course prices sort only inside a comparable official source',()=>{
 const data={offers:[
  {brandId:'x',kind:'course',title:'B 食べ放題コース',price:4000,priceText:'税込4,000円',comparisonKey:'same',rank:1,checkedAt:now.toISOString()},
  {brandId:'x',kind:'course',title:'A 食べ放題コース',price:3000,priceText:'税込3,000円',comparisonKey:'same',rank:2,checkedAt:now.toISOString()},
  {brandId:'x',kind:'course',title:'別条件 食べ放題コース',price:2000,priceText:'税込2,000円',comparisonKey:'other',rank:0,checkedAt:now.toISOString()}
 ]};
 assert.deepEqual(activeOffers(data,'x','course',now).map(x=>x.title),['別条件 食べ放題コース','A 食べ放題コース','B 食べ放題コース']);
});

test('priced course tiles suppress generic descriptive snippets',()=>{
 const data={offers:[
  {brandId:'x',kind:'course',title:'焼肉食べ放題',price:null,priceText:null,comparisonKey:'x',rank:0,checkedAt:now.toISOString()},
  {brandId:'x',kind:'course',title:'牛タン食べ放題コース',price:4378,priceText:'税込4,378円',comparisonKey:'x',rank:1,checkedAt:now.toISOString()},
  {brandId:'x',kind:'course',title:'食べ放題は時間との戦い。スタッフがすばやくお届けします。',price:null,priceText:null,comparisonKey:'x',rank:2,checkedAt:now.toISOString()}
 ]};
 assert.deepEqual(activeOffers(data,'x','course',now).map(x=>x.title),['牛タン食べ放題コース']);
});

test('campaign-only drink copy is not reused as a normal drink tile',()=>{
 const data={offers:[
  {brandId:'x',kind:'drink',title:'学生限定 食べ飲み放題キャンペーン',price:null,priceText:null,comparisonKey:'x',rank:0,checkedAt:now.toISOString()},
  {brandId:'x',kind:'drink',title:'ソフトドリンク飲み放題',price:null,priceText:null,comparisonKey:'x',rank:1,checkedAt:now.toISOString()}
 ]};
 assert.deepEqual(activeOffers(data,'x','drink',now).map(x=>x.title),['ソフトドリンク飲み放題']);
});

test('stale normal menu offers disappear instead of living forever',()=>{
 const data={offers:[{brandId:'x',kind:'drink',title:'飲み放題',price:1000,priceText:'税込1,000円',comparisonKey:'x',rank:0,checkedAt:'2026-09-10T00:00:00Z'}]};
 assert.equal(activeOffers(data,'x','drink',now).length,0);
});

test('high-value menu images are highlights but current-parent evidence is required',()=>{
 const rows=[{id:'fair',contentHash:'new'}];
 const data={assets:[
  {brandId:'x',kind:'detail',title:'骨付きカルビ',campaignId:'fair',parentHash:'new',checkedAt:now.toISOString(),rank:30},
  {brandId:'x',kind:'detail',title:'黒毛和牛',campaignId:'fair',parentHash:'old',checkedAt:now.toISOString(),rank:20},
  {brandId:'x',kind:'detail',title:'サラダ',campaignId:'fair',parentHash:'new',checkedAt:now.toISOString(),rank:10},
  {brandId:'x',kind:'menu',title:'黒毛和牛ランチメニュー',parents:[{campaignId:'fair',parentHash:'new'}],checkedAt:now.toISOString(),rank:5}
 ]};
 assert.deepEqual(selectHighlights(data,'x',rows,now).map(x=>x.title),['骨付きカルビ']);
});

test('discount/member campaigns render as value tiles rather than duplicate fair rows',()=>{
 const rows=[{id:'a',campaignType:'fair',title:'秋フェア'},{id:'b',campaignType:'discount',title:'ネット予約20%OFF'},{id:'c',campaignType:'fair',title:'会員クーポン'}];
 assert.deepEqual(selectPromotions(rows).map(x=>x.id),['b','c']);
 assert.deepEqual(selectFairRows(rows).map(x=>x.id),['a']);
});
