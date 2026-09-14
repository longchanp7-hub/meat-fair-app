import test from 'node:test';
import assert from 'node:assert/strict';
import {planGallery} from '../app/gallery-plan.mjs';
import {selectMedia,renderGallery} from '../app/gallery.mjs';
import {parseHtml} from '../scripts/html-document.mjs';
import {detailAssets,menuAssets,dimensions,publicUrl} from '../scripts/gallery-extract.mjs';
const widths=[320,360,390,430,540,690,768,820,1024];
function check(items,width){
  const p=planGallery(items,width);assert.equal(p.boxes.length,items.length);
  assert.ok(Number.isFinite(p.height));
  for(const b of p.boxes){assert.ok(b.width>0&&b.imageHeight>0);assert.ok(b.x>=-.01&&b.y>=-.01&&b.x+b.width<=width+.01&&b.y+b.height<=p.height+.01);assert.ok(Math.abs(b.width/b.imageHeight-items[b.index].ratio)<.001);}
  for(let i=0;i<p.boxes.length;i++)for(let j=i+1;j<p.boxes.length;j++){
    const a=p.boxes[i],b=p.boxes[j];assert.ok(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<.01||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<.01,'images overlap');
  }
  if(items.length){assert.ok(Math.abs(Math.max(...p.boxes.map(b=>b.x+b.width))-width)<.01);assert.ok(Math.abs(Math.max(...p.boxes.map(b=>b.y+b.height))-p.height)<.01);}
  return p;
}
test('adaptive layout packs 0–16 images at nine phone/Fold/tablet widths without distortion or overlap',()=>{
  for(const width of widths)for(let n=0;n<=16;n++)check(Array.from({length:n},(_,i)=>({ratio:[.45,.8,1,1.4,2,3.5][i%6],kind:i<2?'campaign':'detail'})),width);
});
test('two landscape campaign posters stack on a portrait phone without a brand-specific rule',()=>{
  const p=check([{ratio:2},{ratio:2}],370);assert.ok(p.boxes[1].y>=p.boxes[0].height);
});
test('one image fills the available width; no fictitious placeholder is created',()=>{
  const p=check([{ratio:.7}],390);assert.equal(p.boxes[0].width,390);assert.equal(planGallery([],390).height,0);
});
test('addition, removal and unfolding recompute all positions',()=>{
  const a=[.8,1.5,1.5,2,2].map((ratio,i)=>({ratio,kind:i?'detail':'campaign'}));
  const phone=check(a,370),fold=check(a,790);assert.notEqual(phone.height,fold.height);check(a.slice(0,3),370);check([...a,{ratio:.6}],790);
});
const now=new Date('2026-09-15T00:00:00Z');
const campaign={id:'c',brandId:'b',contentHash:'hash',title:'秋フェア',imageUrl:'https://official.example/main.jpg',officialUrl:'https://official.example/fair/'};
const menu={brandId:'b',kind:'menu',title:'豚2皿ランチ',imageUrl:'https://official.example/lunch.jpg',officialUrl:'https://official.example/lunch/',checkedAt:now.toISOString()};
test('expired campaigns, stale menus and changed parent hashes do not leak into the gallery',()=>{
  const data={assets:[menu,{...menu,kind:'detail',campaignId:'old',parentHash:'hash',imageUrl:'https://official.example/old.jpg'},{...menu,imageUrl:'https://official.example/stale.jpg',checkedAt:'2026-09-01T00:00:00Z'}]};
  assert.equal(selectMedia([campaign],'b',data,'active',now).length,2);
  assert.equal(selectMedia([],'b',data,'ending',now).length,0);
  assert.equal(selectMedia([campaign],'b',data,'new',now).length,1);
});
test('official menu cards have separate labels and never become campaign rows',()=>{
  const markup=renderGallery([campaign],{id:'b',name:'ブランド'},{assets:[]},'active');
  assert.match(markup,/adaptive-gallery/);assert.doesNotMatch(markup,/data-campaign=/);
  assert.doesNotMatch(renderGallery([{...campaign,imageUrl:'javascript:alert(1)'}],{id:'b',name:'x'},{},'active'),/javascript:/);
});
test('detail extractor uses real mobile images, trims leading alt whitespace, excludes artwork duplicates and decorations',()=>{
  const scope=parseHtml(`<main><img src="main.jpg" alt="秋フェア"><img src="food_pc.jpg" alt="九州黒豚 食べ放題"><img src="food_sp.jpg" alt="九州黒豚 食べ放題"><div id="beef"><img src="wagyu.jpg" alt=" 黒毛和牛 食べ放題"></div><img src="icon.jpg" alt="牛コース"><img src="price.jpg" alt="${'料金表 '.repeat(100)}"></main>`);
  const rows=detailAssets(scope,'https://official.example/',{...campaign,imageUrl:'https://official.example/main.jpg'});
  assert.equal(rows.length,2);assert.match(rows[0].imageUrl,/food_sp/);assert.match(rows[1].officialUrl,/#beef$/);
});
test('homepage menu discovery rejects tracking, hiring, already-counted fairs and off-site links',()=>{
  const h=`<main><a href="/lunch/"><img src="lunch.jpg" alt="60分 豚2皿ランチ"></a><a href="/party/"><img src="party.jpg" alt="宴会コース"></a><a href="https://other.example/x"><img src="x.jpg" alt="ランチ"></a><a href="/jobs/"><img src="job.jpg" alt="採用 ランチ"></a><a href="/fair/"><img src="f.jpg" alt="食べ放題コース フェア"></a></main>`;
  assert.equal(menuAssets(h,'https://official.example/',['https://official.example/fair/']).length,2);
});
test('image dimensions are read from bounded PNG/JPEG/WebP headers',()=>{
  const png=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(640,16);png.writeUInt32BE(480,20);assert.deepEqual(dimensions(png),{width:640,height:480});
  const jpeg=Buffer.from([255,216,255,192,0,8,8,1,224,2,128,0,255,217]);assert.deepEqual(dimensions(jpeg),{width:640,height:480});
  const webp=Buffer.alloc(30);webp.write('RIFF');webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUIntLE(639,24,3);webp.writeUIntLE(479,27,3);assert.deepEqual(dimensions(webp),{width:640,height:480});assert.equal(dimensions(Buffer.alloc(3)),null);
});
test('public image requests cannot target local addresses or non-HTTPS resources',()=>{
  for(const u of ['http://official.example/a','https://127.0.0.1/x','https://10.0.0.1/x','file:///a','javascript:alert(1)','https://localhost/x','https://user:pw@official.example/x'])assert.equal(publicUrl(u),null);
});
