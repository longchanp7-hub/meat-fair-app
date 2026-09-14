import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHtml} from '../scripts/html-document.mjs';
import {detailAssets,menuAssets} from '../scripts/gallery-extract.mjs';
import {officialPhotoCandidates} from '../scripts/gallery-photo.mjs';
import {planGallery} from '../app/gallery-plan.mjs';
const base='https://official.example/fair/';
const campaign={id:'test-fair',contentHash:'verified',imageUrl:base+'main.jpg'};
const details=html=>detailAssets(parseHtml(`<main>${html}</main>`),base,campaign);

test('dish photo inherits the observed paired label, not its text-only artwork',()=>{
  const assets=details('<section id="pork"><img src="menu01_pic.webp" alt=""><img src="menu01_text.webp" alt="厚切りポークステーキ 690円（税込759円）"></section>');
  assert.equal(assets.length,1);
  assert.equal(assets[0].imageUrl,base+'menu01_pic.webp');
  assert.match(assets[0].title,/厚切りポークステーキ/);
  assert.equal(assets[0].officialUrl,base+'#pork');
});
test('a sign with no observed matching photo creates neither guessed URL nor blank block',()=>{
  assert.deepEqual(details('<img src="menu02_sign.webp" alt="韓式ハンバーグ 香味だれで食べる トッカルビ"><img src="fair_title.webp" alt="秋の焼肉フェア">'),[]);
});
test('sign-style menus use food photos with identical observed family names',()=>{
  const assets=details('<img src="menu02_pic.webp" alt=""><img src="menu02_sign.webp" alt="韓式ハンバーグ 香味だれで食べる トッカルビ">');
  assert.equal(assets.length,1);assert.equal(assets[0].imageUrl,base+'menu02_pic.webp');
});
test('unrelated directories and conflicting labels are not used to guess photo titles',()=>{
  const items=[
    {imageUrl:base+'a/menu01_pic.webp',title:''},
    {imageUrl:base+'b/menu01_text.webp',title:'牛カルビ'},
    {imageUrl:base+'menu02_pic.webp',title:''},
    {imageUrl:base+'menu02_text.webp',title:'牛カルビ'},
    {imageUrl:base+'menu02_sign.webp',title:'豚ロース'}
  ];
  assert.deepEqual(officialPhotoCandidates(items).map(a=>a.title),['','']);
});
test('mobile and desktop photo/label variants deduplicate without losing the title',()=>{
  const assets=details('<img src="menu01_pic_pc.webp" alt=""><img src="menu01_text_pc.webp" alt="牛カルビ 食べ放題"><img src="menu01_pic_sp.webp" alt=""><img src="menu01_text_sp.webp" alt="牛カルビ 食べ放題">');
  assert.equal(assets.length,1);assert.equal(assets[0].imageUrl,base+'menu01_pic_sp.webp');
});
test('standalone drink images remain excluded after paired-label extraction',()=>{
  assert.equal(details('<img src="menu01_pic.webp" alt=""><img src="menu01_text.webp" alt="飲み放題コース ビール">').length,0);
});
test('captions on another linked page cannot label an unrelated photo',()=>{
  assert.equal(details('<img src="menu01_pic.webp" alt=""><a href="/other/"><img src="menu01_text.webp" alt="牛カルビ食べ放題"></a>').length,0);
});
test('detail counts above eight flow through to the layout rather than being truncated',()=>{
  const assets=details(Array.from({length:19},(_,i)=>`<img src="meal${i}.jpg" alt="牛肉食べ放題 メニュー${i}">`).join(''));
  assert.equal(assets.length,19);
  for(const width of [320,360,390,430,690,768,820,1024]){
    const plan=planGallery(assets.map((_,i)=>({ratio:[.5,1,1.5,2][i%4],kind:'detail'})),width);
    assert.equal(plan.boxes.length,19);
    for(const b of plan.boxes)assert.ok(b.width>0&&b.imageHeight>0&&b.x+b.width<=width+.01);
  }
});
test('eligible homepage menus above eight are retained and text-only banners excluded',()=>{
  const html='<main>'+Array.from({length:11},(_,i)=>`<a href="/lunch-${i}/"><img src="lunch${i}.jpg" alt="牛肉ランチ ${i}"></a>`).join('')+'<a href="/text-lunch/"><img src="lunch_text.webp" alt="牛肉ランチ 文字だけ"></a></main>';
  assert.equal(menuAssets(html,base).length,11);
});
test('photo extraction retains the official title and never mutates source records',()=>{
  const items=[{imageUrl:base+'menu01_pic.webp',title:'公式の牛肉料理'}, {imageUrl:base+'menu01_text.webp',title:'牛カルビ'}];
  const before=JSON.stringify(items);
  assert.equal(officialPhotoCandidates(items)[0].title,'公式の牛肉料理');
  assert.equal(JSON.stringify(items),before);
});
