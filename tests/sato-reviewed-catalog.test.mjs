import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedSatoCatalog} from '../scripts/sato-reviewed-catalog.mjs';

const checkedAt='2026-09-18T12:00:00.000Z';

test('current Sato AYCE menu edition restores distinct shabu and suki rows',()=>{
  const rows=reviewedSatoCatalog('https://sato-res.com/sato/menu/','<a href="/sato/assets/menu/book/ayce-260616/">食べ放題メニュー</a>',checkedAt);
  assert.deepEqual(rows.map(x=>x.title),['さとしゃぶ 食べ放題（大人）','さとすき 食べ放題（大人）']);
  assert.deepEqual(rows.map(x=>x.price.amount),[2189,2189]);
  assert.deepEqual(rows.map(x=>x.officialUrl),['https://sato-res.com/satoshabu/','https://sato-res.com/satosuki/']);
});

test('Sato reviewed AYCE prices fail closed when the official menu edition changes',()=>{
  assert.deepEqual(reviewedSatoCatalog('https://sato-res.com/sato/menu/','<a href="/sato/assets/menu/book/ayce-NEW/">食べ放題メニュー</a>',checkedAt),[]);
});
