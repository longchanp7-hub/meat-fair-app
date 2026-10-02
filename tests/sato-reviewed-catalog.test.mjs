import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedSatoCatalog} from '../scripts/sato-reviewed-catalog.mjs';

const checkedAt='2026-10-02T01:40:00.000Z';
const ayceMarker='<img src="https://www.sato-res.com/cdn/shop/files/other-menu.jpg?v=1790570027&width=1600">';
const yakinikuMarker='<img src="https://www.sato-res.com/cdn/shop/files/yakiniku-menu.jpg?v=1790569988&width=1600">';

test('current Sato AYCE menu edition restores distinct shabu and suki rows',()=>{
  const rows=[
    ...reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satoshabu',ayceMarker,checkedAt),
    ...reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satosuki',ayceMarker,checkedAt)
  ];
  assert.deepEqual(rows.map(x=>x.title),['さとしゃぶ 食べ放題（大人）','さとすき 食べ放題（大人）']);
  assert.deepEqual(rows.map(x=>x.price.amount),[2189,2189]);
  assert.deepEqual(rows.map(x=>x.price.text),['税込2,189円〜6,149円','税込2,189円〜6,149円']);
  assert.deepEqual(rows.map(x=>x.officialUrl),[
    'https://www.sato-res.com/pages/sato-satoshabu',
    'https://www.sato-res.com/pages/sato-satosuki'
  ]);
});

test('Sato reviewed AYCE prices fail closed when the official menu edition changes',()=>{
  assert.deepEqual(reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satoshabu','<img src="other-menu.jpg?v=NEW">',checkedAt),[]);
  assert.deepEqual(reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satosuki','<img src="other-menu.jpg?v=NEW">',checkedAt),[]);
});

test('current Sato yakiniku and bar markers emit current reviewed prices',()=>{
  const yakiniku=reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satoshikiyakiniku',yakinikuMarker,checkedAt);
  assert.deepEqual(yakiniku.map(x=>x.price.amount),[4389,6479]);
  const bar=reviewedSatoCatalog('https://www.sato-res.com/pages/sato-bar','料理とセットでご注文の方、1,428円（税込）',checkedAt);
  assert.equal(bar[0].price.amount,1428);
});
