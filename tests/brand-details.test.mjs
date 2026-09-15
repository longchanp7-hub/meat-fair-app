import test from 'node:test';
import assert from 'node:assert/strict';
import {activeOffers,selectHighlights,selectPromotions,selectFairRows} from '../app/brand-details.mjs';
const now=new Date('2026-09-15T09:00:00+09:00');

test('course prices sort only inside a comparable official source',()=>{
 const data={offers:[
  {brandId:'x',kind:'course',title:'B',price:4000,comparisonKey:'same',rank:1,checkedAt:now.toISOString()},
  {brandId:'x',kind:'course',title:'A',price:3000,comparisonKey:'same',rank:2,checkedAt:now.toISOString()},
  {brandId:'x',kind:'course',title:'別条件',price:2000,comparisonKey:'other',rank:0,checkedAt:now.toISOString()}
 ]};
 assert.deepEqual(activeOffers(data,'x','course',now).map(x=>x.title),['別条件','A','B']);
});

test('stale normal menu offers disappear instead of living forever',()=>{
 const data={offers:[{brandId:'x',kind:'drink',title:'飲み放題',price:1000,comparisonKey:'x',rank:0,checkedAt:'2026-09-10T00:00:00Z'}]};
 assert.equal(activeOffers(data,'x','drink',now).length,0);
});

test('high-value menu images are highlights but current-parent evidence is required',()=>{
 const rows=[{id:'fair',contentHash:'new'}];
 const data={assets:[
  {brandId:'x',kind:'detail',title:'骨付きカルビ',campaignId:'fair',parentHash:'new',checkedAt:now.toISOString(),rank:30},
  {brandId:'x',kind:'detail',title:'黒毛和牛',campaignId:'fair',parentHash:'old',checkedAt:now.toISOString(),rank:20},
  {brandId:'x',kind:'detail',title:'サラダ',campaignId:'fair',parentHash:'new',checkedAt:now.toISOString(),rank:10}
 ]};
 assert.deepEqual(selectHighlights(data,'x',rows,now).map(x=>x.title),['骨付きカルビ']);
});

test('discount/member campaigns render as value tiles rather than duplicate fair rows',()=>{
 const rows=[{id:'a',campaignType:'fair',title:'秋フェア'},{id:'b',campaignType:'discount',title:'ネット予約20%OFF'},{id:'c',campaignType:'fair',title:'会員クーポン'}];
 assert.deepEqual(selectPromotions(rows).map(x=>x.id),['b','c']);
 assert.deepEqual(selectFairRows(rows).map(x=>x.id),['a']);
});
