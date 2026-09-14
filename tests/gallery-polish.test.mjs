import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mediaCaption,isSupplementaryPhoto,selectMedia,renderGallery} from '../app/gallery.mjs';
import {planGallery} from '../app/gallery-plan.mjs';
const now=new Date('2026-09-15T08:00:00+09:00');
const campaign={id:'offer',brandId:'sample',title:'秋のフェア',contentHash:'current',officialUrl:'https://food.example/fair/',imageUrl:'https://food.example/main.jpg'};
const asset=(name,extra={})=>({brandId:'sample',kind:'detail',imageUrl:`https://food.example/${name}`,officialUrl:campaign.officialUrl,campaignId:'offer',parentHash:'current',checkedAt:now.toISOString(),width:750,height:1000,title:'国産牛 食べ放題',rank:20,...extra});

test('tax-inclusive captions preserve official prices without ellipses or invented tax',()=>{
 assert.deepEqual(mediaCaption('九州黒豚 食べ放題 ￥2,399（税込￥2,639）〜 繊細な脂の甘み。'),{title:'九州黒豚 食べ放題',price:'税込2,639円〜'});
 assert.deepEqual(mediaCaption('黒毛和牛 食べ放題 ￥3,399（税込￥3,739）〜 きめ細やかな脂、至福の口どけ'),{title:'黒毛和牛 食べ放題',price:'税込3,739円〜'});
 assert.deepEqual(mediaCaption('平日限定￥999(税込￥1,099)豚肉2皿ランチ'),{title:'平日限定 豚肉2皿ランチ',price:'税込1,099円'});
 for(const title of ['食べ放題 2,000円','宴会コース','土日祝＋200円（税込220円）','追加料金 200円(税込220円)','ひとつの鍋につき＋110円（税込）'])assert.equal(mediaCaption(title).price,'');
 assert.match(mediaCaption('食べ放題 2,000円(税込2,200円) 土日限定').title,/土日限定/);
});

test('heading fragments are excluded without excluding real campaign posters',()=>{
 for(const file of ['hawaiifair_title.webp','menu01_text.webp','menu02_sign.webp','menu_title_sp.jpg'])assert.equal(isSupplementaryPhoto(`https://food.example/${file}`),false);
 for(const file of ['poster.jpg','ss_0901_sp_07.jpg','textured-steak.jpg','dish-title-with-photo.png'])assert.equal(isSupplementaryPhoto(`https://food.example/${file}`),true);
 const media=selectMedia([campaign],'sample',{assets:[asset('menu01_text.webp'),asset('dish.jpg')]},'active',now);
 assert.equal(media.length,2);assert.equal(media[1].imageUrl,'https://food.example/dish.jpg');
 assert.equal(selectMedia([{...campaign,imageUrl:'https://food.example/main_title.png'}],'sample',{},'active',now).length,1);
});

test('a missing primary image uses a verified same-fair poster exactly once and in campaign order',()=>{
 const rows=[{...campaign,imageUrl:null,campaignType:'discount'},{...campaign,id:'other',title:'別のフェア'}];
 const data={assets:[asset('detail.jpg'),asset('announcement.jpg',{title:'敬老の日キャンペーン 20%OFF'})]};
 const selected=selectMedia(rows,'sample',data,'active',now);
 assert.equal(selected[0].imageUrl,'https://food.example/announcement.jpg');
 assert.equal(selected[0].kind,'campaign');assert.equal(selected[0].campaignType,'discount');
 assert.equal(selected[0].title,campaign.title);
 assert.equal(selected.filter(a=>a.imageUrl.endsWith('announcement.jpg')).length,1);
 assert.equal(selected[1].title,'別のフェア');
});

test('expired, changed-parent and different-brand pictures never become replacement posters',()=>{
 for(const extra of [{checkedAt:'2026-09-10T00:00:00Z'},{parentHash:'old'},{brandId:'other'},{campaignId:'gone'}]){
  assert.equal(selectMedia([{...campaign,imageUrl:null}],'sample',{assets:[asset('poster.jpg',extra)]},'active',now).length,0);
 }
 assert.equal(selectMedia([],'sample',{assets:[asset('poster.jpg')]},'active',now).length,0);
});

test('captions keep complete accessible source text while rendering tax-inclusive amount separately',()=>{
 const title='九州黒豚 食べ放題 ￥2,399（税込￥2,639）〜 繊細な脂の甘み。';
 const out=renderGallery([{...campaign,title}],{id:'sample',name:'店'}, {},'active');
 assert.match(out,/<strong class="media-price">税込2,639円〜<\/strong>/);
 assert.match(out,/<span class="media-title">九州黒豚 食べ放題<\/span>/);
 assert.ok(out.includes(`alt="${title}"`));assert.ok(out.includes(`title="${title}"`));
 const unsafe=renderGallery([{...campaign,title:'<img onerror="x">'}],{id:'sample',name:'店'}, {},'active');
 assert.ok(!unsafe.includes('alt="<img'));assert.ok(unsafe.includes('&lt;img'));
});

test('mixed caption heights and larger text preserve packing for all current brands',()=>{
 const gallery=JSON.parse(fs.readFileSync(new URL('../app/data/gallery.json',import.meta.url)));
 let scenarios=0;
 for(const brandId of new Set(gallery.assets.map(a=>a.brandId))){
  const assets=gallery.assets.filter(a=>a.brandId===brandId);
  for(const width of [280,320,360,390,430,600,690,820,1024])for(const scale of [1,1.25,1.5,2]){
   const items=assets.map(a=>({ratio:a.width/a.height,kind:a.kind,captionHeight:mediaCaption(a.title).price?88:64}));
   const plan=planGallery(items,width/scale,6/scale);
   assert.equal(plan.boxes.length,items.length);
   for(const [i,b]of plan.boxes.entries()){
    assert.ok(b.width>0&&b.imageHeight>0);
    assert.ok(b.x>=-1e-6&&b.y>=-1e-6&&b.x+b.width<=width/scale+1e-6&&b.y+b.height<=plan.height+1e-6);
    assert.ok(Math.abs(b.width/b.imageHeight-items[i].ratio)<1e-6);
    for(const other of plan.boxes.slice(i+1))assert.ok(Math.min(b.x+b.width,other.x+other.width)-Math.max(b.x,other.x)<1e-6||Math.min(b.y+b.height,other.y+other.height)-Math.max(b.y,other.y)<1e-6);
   }
   scenarios++;
  }
 }
 console.log(`Readability layout scenarios: ${scenarios}`);
});
