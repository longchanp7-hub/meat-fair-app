import test from 'node:test';
import assert from 'node:assert/strict';
import {planGallery} from '../app/gallery-plan.mjs';
import {mediaSemantics} from '../app/gallery-semantics.mjs';

test('two landscape images stack on a portrait phone but may share a row on a Fold',()=>{
 const items=[0,1].map(()=>({ratio:2,captionHeight:64,kind:'detail',group:'support',visualWeight:1.25}));
 const phone=planGallery(items,390,6),fold=planGallery(items,820,6);
 assert.equal(phone.boxes.length,2);
 assert.ok(Math.abs(phone.boxes[0].x-phone.boxes[1].x)<1e-6);
 assert.ok(phone.boxes[1].y>phone.boxes[0].y);
 assert.equal(fold.boxes.length,2);
 assert.ok(fold.boxes.every(b=>b.width>0&&b.imageHeight>0));
});

test('generic semantics put meat courses before lunch and banquet support tiles',()=>{
 const rows=[
  mediaSemantics({kind:'detail',title:'九州黒豚 食べ放題'}),
  mediaSemantics({kind:'detail',title:'黒毛和牛 食べ放題'}),
  mediaSemantics({kind:'menu',title:'60分 豚肉2皿ランチ'}),
  mediaSemantics({kind:'menu',title:'宴会コース'})
 ];
 assert.deepEqual(rows.map(x=>x.group),['course','course','support','support']);
 assert.deepEqual(rows.map(x=>x.priority),[20,20,30,31]);
 assert.ok(rows.every(x=>x.visualWeight>1));
});
