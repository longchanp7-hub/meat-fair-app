import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleBrand,fairAssetVisible,catalogEntryVisible} from '../app/presentation.mjs';
import {renderCatalog} from '../app/catalog.mjs';
import {reviewedSatoCatalog} from '../scripts/sato-reviewed-catalog.mjs';

test('Kushiya is outside the 15-chain local target while reviewed chains remain visible',()=>{
 assert.equal(visibleBrand('kushiya-monogatari'),false);
 for(const id of ['yakiniku-king','gyukaku','syabuyo','yuzuan','washoku-sato','amiyakitei','amiyakitei-plus','onyasai','roan','kalubi-taisho','stamina-taro','asakuma','nikusho-sakai','jukusei-ichiban','anrakutei'])assert.equal(visibleBrand(id),true);
});

test('reviewed compact galleries hide ordinary dish clutter but retain Shabuyo featured meat blocks',()=>{
 assert.equal(fairAssetVisible('yakiniku-king',{kind:'detail',group:'dish',title:'個別料理'}),false);
 assert.equal(fairAssetVisible('syabuyo',{kind:'detail',group:'course',title:'九州黒豚 食べ放題'}),true);
 assert.equal(fairAssetVisible('syabuyo',{kind:'detail',group:'course',title:'黒毛和牛 食べ放題'}),true);
 assert.equal(fairAssetVisible('syabuyo',{kind:'detail',group:'dish',title:'おすすめの鴨肉'}),false);
 assert.equal(fairAssetVisible('syabuyo',{kind:'campaign',group:'campaign',title:'秋のきのこと鴨しゃぶフェア'}),true);
});

test('reviewed chain rules remove the specific clutter rejected in the visual review',()=>{
 assert.equal(catalogEntryVisible('stamina-taro',{kind:'highlight',title:'牛タン'}),false);
 assert.equal(catalogEntryVisible('asakuma',{kind:'highlight',title:'カレー'}),false);
 assert.equal(catalogEntryVisible('asakuma',{kind:'course',title:'45品目!!食べ放題サラダバー! 対象店舗'}),true);
 assert.equal(catalogEntryVisible('asakuma',{kind:'course',title:'肉味噌ハンバーグ(平日ランチ)(サラダバー付)'}),false);
 for(const title of ['よくばりコース','大将スペシャルコース','特選プレミアムコース'])assert.equal(catalogEntryVisible('kalubi-taisho',{kind:'course',title}),true);
 for(const title of ['アプリ会員限定カジュアルコース','特選プレミアムコース+追加オプション'])assert.equal(catalogEntryVisible('kalubi-taisho',{kind:'course',title}),false);
 assert.equal(catalogEntryVisible('roan',{kind:'course',title:'旬菜ビュッフェ ランチ（平日・豊川店）'}),true);
 assert.equal(catalogEntryVisible('roan',{kind:'course',title:'麻辣湯コース(土日ランチ・ディナー)'}),false);
 assert.equal(catalogEntryVisible('amiyakitei',{kind:'course',title:'スタンダード 食べ放題コース'}),true);
 assert.equal(catalogEntryVisible('amiyakitei',{kind:'course',title:'黒毛和牛お手軽コース'}),false);
 assert.equal(catalogEntryVisible('amiyakitei-plus',{kind:'course',title:'黒毛和牛お手軽コース'}),true);
 assert.equal(catalogEntryVisible('amiyakitei-plus',{kind:'course',title:'焼肉食べ放題 感激どんどん'}),false);
 for(const title of ['さとしゃぶ 食べ放題','さとすき 食べ放題','さと式焼肉 牛＆豚プレミアムコース'])assert.equal(catalogEntryVisible('washoku-sato',{kind:'course',title}),true);
});

test('Sakai course panels follow the reviewed cheap-to-premium order even with unknown image-only prices',()=>{
 const now=new Date('2026-09-15T03:00:00Z'),checkedAt=now.toISOString(),url='https://example.com/menu/';
 const titles=['肉匠坂井スペシャルコース','贅沢プレミアムコース','お手軽コース','肉匠坂井ライトコース'];
 const entries=titles.map((title,i)=>({id:String(i),brandId:'nikusho-sakai',kind:'course',title,officialUrl:url,sourceUrl:url,checkedAt,price:{amount:null,text:null,taxIncluded:null},context:{service:'公式掲載枠',days:'公式掲載条件',audience:'公式の基本料金'},comparisonKey:'same',conditions:[],targetCourses:[],rank:i,verificationState:'confirmed'}));
 const fairs={updatedAt:'same',campaigns:[]},data={schemaVersion:1,fairsUpdatedAt:'same',entries};
 const html=renderCatalog({id:'nikusho-sakai',name:'肉匠坂井',homeUrl:url},data,fairs,{},now);
 const positions=['お手軽コース','肉匠坂井ライトコース','肉匠坂井スペシャルコース','贅沢プレミアムコース'].map(x=>html.indexOf(x));
 assert.ok(positions.every(x=>x>=0));assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
});

test('Shabuyo renders one priced weekday dinner row instead of priced/unpriced duplicates',()=>{
 const now=new Date('2026-09-15T03:00:00Z'),checkedAt=now.toISOString(),url='https://example.com/';
 const common={brandId:'syabuyo',kind:'course',title:'【平日ディナー限定】宴会コース',officialUrl:url,sourceUrl:url,checkedAt,context:{service:'ディナー',days:'平日',audience:'大人'},comparisonKey:'dinner',conditions:[],targetCourses:[],verificationState:'confirmed'};
 const entries=[{...common,id:'u',price:{amount:null,text:null,taxIncluded:null}},{...common,id:'p',price:{amount:3000,text:'税込3,000円',taxIncluded:true}}];
 const fairs={updatedAt:'same',campaigns:[]},data={schemaVersion:1,fairsUpdatedAt:'same',entries};
 const html=renderCatalog({id:'syabuyo',name:'しゃぶ葉',homeUrl:url},data,fairs,{},now);
 assert.equal((html.match(/【平日ディナー限定】宴会コース/g)||[]).length,1);assert.match(html,/税込3,000円/);
});

test('Roan reviewed regular prices collapse into three simple course rows',()=>{
 const now=new Date('2026-09-15T03:00:00Z'),checkedAt=now.toISOString(),url='https://example.com/price/';
 const offer=(id,title,priceText,comparisonKey,kind='course')=>({id,brandId:'roan',kind,title,priceText,conditions:[],officialUrl:url,sourceUrl:url,checkedAt,comparisonKey,verificationState:'reviewed_fallback'});
 const offers={offers:[
  offer('l1','旬菜ビュッフェ ランチ（平日・豊川店）','税込2,300円','l1'),offer('l2','旬菜ビュッフェ ランチ（土日祝・豊川店）','税込2,400円','l2'),
  offer('p1','三元豚しゃぶと旬菜ビュッフェ（平日ディナー・豊川店）','税込3,100円','p1'),offer('p2','三元豚しゃぶと旬菜ビュッフェ（土日祝・豊川店）','税込3,200円','p2'),
  offer('b1','厳選牛しゃぶと旬菜ビュッフェ（平日ディナー・豊川店）','税込3,500円','b1'),offer('b2','厳選牛しゃぶと旬菜ビュッフェ（土日祝・豊川店）','税込3,600円','b2'),
  offer('d1','ドリンクバー（豊川店）','コース料金に含む','d1','drink'),offer('d2','お酒飲み放題（豊川店）','税込1,980円','d2','drink')
 ]};
 const fairs={updatedAt:'same',campaigns:[]},data={schemaVersion:1,fairsUpdatedAt:'same',entries:[]};
 const html=renderCatalog({id:'roan',name:'露菴',homeUrl:url},data,fairs,{},now,offers);
 assert.match(html,/税込2,300〜2,400円/);assert.match(html,/税込3,100〜3,200円/);assert.match(html,/税込3,500〜3,600円/);
 assert.equal((html.match(/旬菜ビュッフェ ランチ/g)||[]).length,1);assert.match(html,/税込1,980円/);
});

test('Sato reviewed prices fail closed unless the exact current official menu marker is present',()=>{
 const at='2026-10-02T01:40:00Z';
 assert.equal(reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satoshabu','old menu',at).length,0);
 const marker='src="https://www.sato-res.com/cdn/shop/files/other-menu.jpg?v=1790570027&width=1600"';
 const shabu=reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satoshabu',marker,at);
 assert.equal(shabu.length,1);assert.equal(shabu[0].price.text,'税込2,189円〜6,149円');
 const suki=reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satosuki',marker,at);
 assert.equal(suki[0].title,'さとすき 食べ放題（大人）');
 const yaki=reviewedSatoCatalog('https://www.sato-res.com/pages/sato-satoshikiyakiniku','<img src="yakiniku-menu.jpg?v=1790569988&width=1600">',at);
 assert.deepEqual(yaki.map(x=>x.price.amount),[4389,6479]);
 const bar=reviewedSatoCatalog('https://www.sato-res.com/pages/sato-bar','料理とセットでご注文の方、1,428円（税込）',at);
 assert.equal(bar[0].price.amount,1428);
});
