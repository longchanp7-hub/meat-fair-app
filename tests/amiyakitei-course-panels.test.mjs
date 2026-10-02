import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCatalog} from '../app/catalog.mjs';

const now=new Date('2026-09-30T03:00:00Z');
const url='https://amiyakitei.jp/menu/';
const regularBrand={id:'amiyakitei',name:'あみやき亭',homeUrl:url};
const plusBrand={id:'amiyakitei-plus',name:'あみやき亭Plus',homeUrl:url};
const fairs={updatedAt:'same',campaigns:[]};
const course=(id,title,amount,brandId,subBrand)=>({
 id,brandId,kind:'course',title,officialUrl:url,sourceUrl:url,
 checkedAt:now.toISOString(),price:{amount,text:`税込${amount.toLocaleString('ja-JP')}円`,taxIncluded:true},
 context:{subBrand,service:'公式掲載枠',days:'公式掲載条件',audience:'公式の基本料金'},
 comparisonKey:subBrand,comparisonEvidence:'same-official-course-table',
 imageUrl:`https://example.com/${id}.jpg`,width:768,height:512,verificationState:'confirmed'
});
const entries=[
 course('regular-high','牛タン&和牛一頭買い 食べ放題コース',5500,'amiyakitei','あみやき亭'),
 course('regular-middle','国産黒毛和牛 食べ放題コース',4500,'amiyakitei','あみやき亭'),
 course('regular-low','スタンダード 食べ放題コース',3500,'amiyakitei','あみやき亭'),
 course('plus-high','全メニュー贅沢コース',5808,'amiyakitei-plus','あみやき亭Plus'),
 course('plus-middle','黒毛和牛堪能コース',4488,'amiyakitei-plus','あみやき亭Plus'),
 course('plus-low','黒毛和牛お手軽コース',3828,'amiyakitei-plus','あみやき亭Plus')
];
const render=(brand,rows)=>renderCatalog(brand,{schemaVersion:1,fairsUpdatedAt:'same',entries:rows},fairs,{},now);

test('Amiyakitei and Plus render as separate three-course cards with ordered photo panels',()=>{
 const regular=render(regularBrand,entries),plus=render(plusBrand,entries);
 for(const [html,ids,label] of [
  [regular,['regular-low','regular-middle','regular-high'],'あみやき亭'],
  [plus,['plus-low','plus-middle','plus-high'],'あみやき亭Plus']
 ]){
  const section=html.split('data-catalog-section="course"')[1].split('</section>')[0];
  assert.equal((section.match(/class="catalog-photo-card"/g)||[]).length,3);
  assert.equal((section.match(/class="catalog-card compact-card"/g)||[]).length,0);
  assert.deepEqual([...section.matchAll(/data-catalog-id="([^"]+)"/g)].map(m=>m[1]),ids);
  assert.match(section,new RegExp(`<small>${label}<\\/small>`));
 }
 assert.doesNotMatch(regular,/plus-low|黒毛和牛お手軽コース/);
 assert.doesNotMatch(plus,/regular-low|スタンダード 食べ放題コース/);
});

test('Amiyakitei keeps text-only courses and drinks when no usable course photo exists',()=>{
 const base=entries.find(e=>e.id==='regular-high'),photo=entries.find(e=>e.id==='regular-low');
 for(const image of [{imageUrl:null},{width:100},{imageUrl:'javascript:alert(1)'}]){
  const textOnly={...base,...image};
  const drink={...entries.find(e=>e.id==='regular-middle'),id:'drink',kind:'drink',title:'飲み放題',imageUrl:null};
  const html=render(regularBrand,[textOnly,photo,drink]);
  for(const id of [textOnly.id,photo.id,drink.id])assert.equal((html.match(new RegExp(`data-catalog-id="${id}"`,'g'))||[]).length,1);
  assert.equal((html.match(/class="catalog-card compact-card"/g)||[]).length,2);
  assert.equal((html.match(/class="catalog-photo-card"/g)||[]).length,1);
 }
});
