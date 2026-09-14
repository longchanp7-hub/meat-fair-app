import test from 'node:test';
import assert from 'node:assert/strict';
import {selectMedia} from '../app/gallery.mjs';
const now=new Date('2026-09-15T00:00:00Z');
const campaign={id:'c',brandId:'b',contentHash:'hash',title:'秋フェア',imageUrl:'https://official.example/main.jpg',officialUrl:'https://official.example/fair/'};
const common={brandId:'b',officialUrl:'https://official.example/fair/',checkedAt:now.toISOString()};
const detail={...common,kind:'detail',campaignId:'c',parentHash:'hash',rank:50,title:'牛肉メニュー',imageUrl:'https://official.example/beef.jpg'};
const lunch={...common,kind:'menu',rank:35,title:'ランチ',imageUrl:'https://official.example/lunch.jpg'};
const banquet={...common,kind:'menu',rank:40,title:'宴会',imageUrl:'https://official.example/banquet.jpg'};
test('category order keeps main then food then lunch and banquet when old data ranks food last',()=>{
  const assets=selectMedia([campaign],'b',{assets:[banquet,lunch,detail]},'active',now);
  assert.deepEqual(assets.map(a=>a.title),['秋フェア','牛肉メニュー','ランチ','宴会']);
});
test('changing image counts preserves semantic order without placeholders',()=>{
  const data={assets:[banquet,lunch,detail]};
  assert.equal(selectMedia([campaign],'b',data,'active',now).length,4);
  assert.deepEqual(selectMedia([campaign],'b',{assets:[banquet,detail]},'active',now).map(a=>a.kind),['campaign','detail','menu']);
  assert.deepEqual(selectMedia([],'b',{},'active',now),[]);
});
