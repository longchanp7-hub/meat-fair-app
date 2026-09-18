import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedSyabuyoStudentCatalog} from '../scripts/syabuyo-reviewed-catalog.mjs';
import {reviewedIchibanStudentCatalog} from '../scripts/ichiban-reviewed-catalog.mjs';

const at='2026-09-18T12:00:00.000Z';

test('Shabuyo active student page yields two reviewed student courses',()=>{
  const html='<main><h1>学生食べ放題コース</h1><img alt="豚コース"><img alt="牛コース"></main>';
  const rows=reviewedSyabuyoStudentCatalog('https://www.skylark.co.jp/syabuyo/gakusei/index.html',html,at);
  assert.deepEqual(rows.map(x=>x.price.amount),[2000,2500]);
  assert.ok(rows.every(x=>x.conditions.includes('前日まで要予約')));
});
test('Shabuyo reviewed student prices fail closed if course markers disappear',()=>{
  assert.deepEqual(reviewedSyabuyoStudentCatalog('https://www.skylark.co.jp/syabuyo/gakusei/index.html','<main>通常メニュー</main>',at),[]);
});
test('Ichiban current menu link yields reviewed student course',()=>{
  const rows=reviewedIchibanStudentCatalog('https://www.jukusei-ichiban.jp/jp/menu/','<a href="student_menu_link.pdf">学生専用食べ放題</a>',at);
  assert.equal(rows.length,1);
  assert.equal(rows[0].price.amount,2500);
  assert.match(rows[0].officialUrl,/student_menu_link\.pdf$/);
});
test('Ichiban reviewed student course fails closed if official PDF link disappears',()=>{
  assert.deepEqual(reviewedIchibanStudentCatalog('https://www.jukusei-ichiban.jp/jp/menu/','<main>通常メニュー</main>',at),[]);
});
