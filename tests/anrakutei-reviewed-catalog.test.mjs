import test from 'node:test';
import assert from 'node:assert/strict';
import {ANRAKUTEI_PRICE_NOTICE,reviewedAnrakuteiCatalog,reconcileAnrakuteiCatalog} from '../scripts/anrakutei-reviewed-catalog.mjs';

const checkedAt='2026-09-17T01:30:00.000Z';
const notice=`<main><h1>食べ放題コース価格改定</h1><p>2026年9月17日より</p>
<p>スタンダードコース 3,280円 税込3,608円</p>
<p>デラックスコース 4,680円 税込5,148円</p>
<p>プライムコース 6,980円 税込7,678円</p>
<p>プレミアムゴージャスコース 9,800円 税込10,780円</p>
<p>全食べ放題コースにソフトドリンク飲み放題を追加料金なしで含みます。</p></main>`;

test('Anrakutei effective price notice creates four exact course prices and included soft drinks',()=>{
 const rows=reviewedAnrakuteiCatalog(ANRAKUTEI_PRICE_NOTICE,notice,checkedAt);
 assert.equal(rows.length,5);
 assert.deepEqual(rows.filter(x=>x.kind==='course').map(x=>x.price.amount),[3608,5148,7678,10780]);
 const drink=rows.find(x=>x.kind==='drink');assert.equal(drink.price.amount,0);assert.match(drink.price.text,/含む/);
});

test('Anrakutei notice parser fails closed when one required price or marker is absent',()=>{
 assert.deepEqual(reviewedAnrakuteiCatalog(ANRAKUTEI_PRICE_NOTICE,notice.replace('税込7,678円','税込7,700円'),checkedAt),[]);
 assert.deepEqual(reviewedAnrakuteiCatalog(ANRAKUTEI_PRICE_NOTICE,notice.replace('追加料金なし',''),checkedAt),[]);
});

test('effective notice replaces known old core rows but yields to a fully changed current menu',()=>{
 const reviewed=reviewedAnrakuteiCatalog(ANRAKUTEI_PRICE_NOTICE,notice,checkedAt);
 const auto=(title,amount)=>({brandId:'anrakutei',kind:'course',title,sourceUrl:'https://anrakutei.jp/menucate/tabehoudai/',price:{amount}});
 const old=[auto('ベーシックコース',4048),auto('デラックスコース',5478),auto('プライムコース',8008),auto('プレミアムゴージャスコース',16500)];
 const reconciled=reconcileAnrakuteiCatalog([...old,...reviewed]);
 assert.equal(reconciled.filter(x=>x.kind==='course').length,4);assert.ok(reconciled.every(x=>x.sourceMethod==='reviewed-effective-price-notice'));
 const future=[auto('スタンダードコース',3700),auto('デラックスコース',5300),auto('プライムコース',7800),auto('プレミアムゴージャスコース',11000)];
 const futureResult=reconcileAnrakuteiCatalog([...future,...reviewed]);
 assert.ok(futureResult.some(x=>x.price?.amount===3700));assert.ok(!futureResult.some(x=>x.sourceMethod==='reviewed-effective-price-notice'));
});
