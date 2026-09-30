import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCatalog} from '../app/catalog.mjs';

const now=new Date('2026-09-30T03:00:00Z');
const url='https://amiyakitei.jp/menu/';
const brand={id:'amiyakitei',name:'あみやき亭',homeUrl:url};
const fairs={updatedAt:'same',campaigns:[]};
const course=(id,title,amount,subBrand)=>({
 id,brandId:brand.id,kind:'course',title,officialUrl:url,sourceUrl:url,
 checkedAt:now.toISOString(),price:{amount,text:`税込${amount.toLocaleString('ja-JP')}円`,taxIncluded:true},
 context:{subBrand,service:'公式掲載枠',days:'公式掲載条件',audience:'公式の基本料金'},
 comparisonKey:subBrand,comparisonEvidence:'same-official-course-table',
 imageUrl:`https://example.com/${id}.jpg`,width:768,height:512,verificationState:'confirmed'
});
const entries=[
 course('regular-high','牛タン&和牛一頭買い 食べ放題コース',5500,'あみやき亭'),
 course('regular-middle','国産黒毛和牛 食べ放題コース',4500,'あみやき亭'),
 course('regular-low','スタンダード 食べ放題コース',3500,'あみやき亭'),
 course('plus-high','全メニュー贅沢コース',5808,'あみやき亭Plus'),
 course('plus-middle','黒毛和牛堪能コース',4488,'あみやき亭Plus'),
 course('plus-low','黒毛和牛お手軽コース',3828,'あみやき亭Plus')
];
const render=rows=>renderCatalog(brand,{schemaVersion:1,fairsUpdatedAt:'same',entries:rows},fairs,{},now);

test('Amiyakitei and Plus render each of their six courses once with photos and ordered prices',()=>{
 const html=render(entries),section=html.split('data-catalog-section="course"')[1].split('</section>')[0];
 assert.equal((section.match(/class="catalog-photo-card"/g)||[]).length,6);
 assert.equal((section.match(/class="catalog-card compact-card"/g)||[]).length,0);
 for(const entry of entries){
  assert.equal((section.match(new RegExp(`data-catalog-id="${entry.id}"`,'g'))||[]).length,1);
  assert.ok(section.includes(`src="${entry.imageUrl}"`));
  assert.ok(section.includes(entry.price.text));
 }
 assert.deepEqual([...section.matchAll(/data-catalog-id="([^"]+)"/g)].map(m=>m[1]),[
  'regular-low','regular-middle','regular-high','plus-low','plus-middle','plus-high'
 ]);
 assert.match(section,/<small>あみやき亭<\/small>/);
 assert.match(section,/<small>あみやき亭Plus<\/small>/);
});

test('Amiyakitei keeps text-only courses and drinks when no usable course photo exists',()=>{
 for(const image of [{imageUrl:null},{width:100},{imageUrl:'javascript:alert(1)'}]){
  const textOnly={...entries[0],...image};
  const drink={...entries[1],id:'drink',kind:'drink',title:'飲み放題',imageUrl:null};
  const html=render([textOnly,entries[2],drink]);
  for(const id of [textOnly.id,entries[2].id,drink.id])assert.equal((html.match(new RegExp(`data-catalog-id="${id}"`,'g'))||[]).length,1);
  assert.equal((html.match(/class="catalog-card compact-card"/g)||[]).length,2);
  assert.equal((html.match(/class="catalog-photo-card"/g)||[]).length,1);
 }
});
