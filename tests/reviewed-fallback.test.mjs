import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedCatalogFallbacks} from '../app/catalog-reviewed-bridge.mjs';

test('reviewed outage fallback remains usable for seven days but expires afterwards',()=>{
 const offer={brandId:'roan',kind:'course',title:'旬菜ビュッフェ ランチ（平日・豊川店）',priceText:'税込2,300円',conditions:['平日','ランチ','豊川店','大人'],officialUrl:'https://example.com/price',sourceUrl:'https://example.com/price',comparisonKey:'roan',checkedAt:'2026-09-15T00:00:00Z',verificationState:'reviewed_fallback'};
 assert.equal(reviewedCatalogFallbacks({offers:[offer]},'roan',[],new Date('2026-09-21T23:59:59Z')).length,1);
 assert.equal(reviewedCatalogFallbacks({offers:[offer]},'roan',[],new Date('2026-09-22T00:00:01Z')).length,0);
});
