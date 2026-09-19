import test from 'node:test';
import assert from 'node:assert/strict';
import {ROAN_DINNER_URL,reviewedRoanCatalog,reconcileRoanCatalog} from '../scripts/roan-reviewed-catalog.mjs';

const at='2026-09-19T00:09:01.000Z';
const html='<main><h1>【9月】夜も、旬を愉しむ。露菴の旬菜ビュッフェディナー</h1><p>平日 税込2,880円(税込) 土日祝 税込2,980円(税込)</p><p>どちらもドリンクバーとデザート食べ放題付きです。</p></main>';

test('Roan current dinner article yields two exact adult prices and included drinks',()=>{
 const rows=reviewedRoanCatalog(ROAN_DINNER_URL,html,at);
 assert.deepEqual(rows.filter(x=>x.kind==='course').map(x=>x.price.amount),[2880,2980]);
 const drink=rows.find(x=>x.kind==='drink');assert.equal(drink.price.amount,0);assert.match(drink.price.text,/含む/);
});
test('Roan reviewed dinner fails closed when any exact current marker disappears',()=>{
 assert.deepEqual(reviewedRoanCatalog(ROAN_DINNER_URL,html.replace('税込2,980円','税込3,080円'),at),[]);
});
test('Roan reviewed dinner replaces noisy auto rows from the same article only',()=>{
 const auto={brandId:'roan',kind:'course',title:'長い自動抽出行',sourceUrl:ROAN_DINNER_URL};
 const other={brandId:'roan',kind:'course',title:'他のコース',sourceUrl:'https://example.com/'};
 const rows=reviewedRoanCatalog(ROAN_DINNER_URL,html,at);
 const reconciled=reconcileRoanCatalog([auto,other,...rows]);
 assert.ok(!reconciled.includes(auto));assert.ok(reconciled.includes(other));assert.equal(reconciled.filter(x=>x.sourceUrl===ROAN_DINNER_URL).length,3);
});
