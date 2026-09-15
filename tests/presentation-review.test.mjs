import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleBrand,fairAssetVisible,catalogEntryVisible} from '../app/presentation.mjs';
import {reviewedSatoCatalog} from '../scripts/sato-reviewed-catalog.mjs';

test('Kushiya is outside the 14-chain local target while reviewed chains remain visible',()=>{
 assert.equal(visibleBrand('kushiya-monogatari'),false);
 for(const id of ['yakiniku-king','gyukaku','syabuyo','yuzuan','washoku-sato','amiyakitei','onyasai','roan','kalubi-taisho','stamina-taro','asakuma','nikusho-sakai','jukusei-ichiban','anrakutei'])assert.equal(visibleBrand(id),true);
});

test('reviewed compact galleries hide ordinary dish clutter but retain Shabuyo featured meat blocks',()=>{
 assert.equal(fairAssetVisible('yakiniku-king',{kind:'detail',group:'dish',title:'個別料理'}),false);
 assert.equal(fairAssetVisible('syabuyo',{kind:'detail',group:'course',title:'九州黒豚 食べ放題'}),true);
 assert.equal(fairAssetVisible('syabuyo',{kind:'detail',group:'course',title:'黒毛和牛 食べ放題'}),true);
 assert.equal(fairAssetVisible('syabuyo',{kind:'detail',group:'dish',title:'おすすめの鴨肉'}),false);
 assert.equal(fairAssetVisible('syabuyo',{kind:'campaign',group:'campaign',title:'秋のきのこと鴨しゃぶフェア'}),true);
});

test('highlight menu rows are removed and Sato modes remain distinct',()=>{
 assert.equal(catalogEntryVisible('stamina-taro',{kind:'highlight',title:'牛タン'}),false);
 assert.equal(catalogEntryVisible('asakuma',{kind:'highlight',title:'カレー'}),false);
 for(const title of ['さとしゃぶ 食べ放題','さとすき 食べ放題','さと式焼肉 牛＆豚プレミアムコース'])assert.equal(catalogEntryVisible('washoku-sato',{kind:'course',title}),true);
});

test('Sato reviewed prices fail closed unless the exact current official menu marker is present',()=>{
 const at='2026-09-15T03:00:00Z';
 assert.equal(reviewedSatoCatalog('https://sato-res.com/satoshabu/','old menu',at).length,0);
 const shabu=reviewedSatoCatalog('https://sato-res.com/satoshabu/','href="/sato/assets/menu/book/ayce-260616/"',at);
 assert.equal(shabu.length,1);assert.equal(shabu[0].price.text,'税込2,189円〜6,039円');
 const suki=reviewedSatoCatalog('https://sato-res.com/satosuki/','ayce-260616',at);
 assert.equal(suki[0].title,'さとすき 食べ放題（大人）');
 const yaki=reviewedSatoCatalog('https://sato-res.com/satoyaki/','<img src="menu-260409-01.jpg">',at);
 assert.deepEqual(yaki.map(x=>x.price.amount),[4279,6369]);
 const bar=reviewedSatoCatalog('https://sato-res.com/sato/bar/','料理とセットでご注文の方、1,978（税込）',at);
 assert.equal(bar[0].price.amount,1978);
});
