import test from 'node:test';import assert from 'node:assert/strict';
import {reviewedCatalogFallbacks} from '../app/catalog-reviewed-bridge.mjs';
import {renderCatalog} from '../app/catalog.mjs';
const now=new Date('2026-09-15T02:00:00Z');
const row={id:'a',brandId:'x',kind:'course',title:'ビュッフェ（豊川店・平日）',price:2300,priceText:'税込2,300円',conditions:['豊川店','平日','ランチ','大人'],sourceUrl:'https://example.com/price/',officialUrl:'https://example.com/price/',checkedAt:'2026-09-15T00:55:00Z',verificationState:'reviewed_fallback',comparisonKey:'toyokawa-weekday-lunch'};
test('concurrent main reviewed prices keep their original timestamp, provenance and expiry',()=>{
 const rows=reviewedCatalogFallbacks({offers:[row]},'x',[],now);assert.equal(rows.length,1);assert.equal(rows[0].checkedAt,row.checkedAt);assert.equal(rows[0].verificationState,'last_known_good');assert.equal(rows[0].price.amount,2300);
 assert.equal(reviewedCatalogFallbacks({offers:[{...row,checkedAt:'2026-09-12T00:00:00Z'}]},'x',[],now).length,0);
 assert.equal(reviewedCatalogFallbacks({offers:[{...row,verificationState:'confirmed'}]},'x',[],now).length,0);
});
test('current verified catalog entries do not duplicate a reviewed fallback of the same source and title',()=>{
 assert.equal(reviewedCatalogFallbacks({offers:[row]},'x',[row],now).length,0);
});
test('reviewed alcohol prices and included soft drinks remain distinct in one unified catalog',()=>{
 const data={offers:[{...row,id:'alcohol',kind:'drink',title:'お酒飲み放題（豊川店）',priceText:'税込1,980円'},{...row,id:'soft',kind:'drink',title:'ドリンクバー（豊川店）',priceText:'コース料金に含む'}]};
 const html=renderCatalog({id:'x',name:'x',homeUrl:'https://example.com/'},{schemaVersion:1,entries:[]},{campaigns:[],updatedAt:'t'},{assets:[]},now,data);
 assert.equal((html.match(/data-catalog-section="drink"/g)||[]).length,1);assert.match(html,/税込1,980円/);assert.match(html,/コース料金に含む/);assert.match(html,/前回の確認情報/);
});
