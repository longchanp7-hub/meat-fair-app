import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mediaSemantics,bindMenus,hasCurrentParent} from '../app/gallery-semantics.mjs';
import {selectMedia,mediaCaption} from '../app/gallery.mjs';
import {planGallery} from '../app/gallery-plan.mjs';
const now=new Date('2026-09-15T09:00:00+09:00');
const fair={id:'fair',brandId:'brand',contentHash:'current',title:'秋フェア',officialUrl:'https://official.example/fair/',imageUrl:'https://official.example/main.jpg'};
const menu={brandId:'brand',kind:'menu',rank:35,title:'豚肉2皿ランチ',imageUrl:'https://official.example/lunch.jpg',officialUrl:'https://official.example/menu/',checkedAt:now.toISOString()};
const linked=bindMenus([menu],[fair],'homepage-hash')[0];

test('menus have explicit evidence and may not outlive, switch or change their original fair',()=>{
  assert.equal(linked.sourceHash,'homepage-hash');
  assert.equal(hasCurrentParent(linked,[fair],now),true);
  for(const rows of [[],[{...fair,id:'replacement'}],[{...fair,contentHash:'changed'}],[{...fair,brandId:'other'}],[{...fair,lifecycleStatus:'ended_official'}],[{...fair,endDate:'2026-09-14'}]]) {
    assert.equal(hasCurrentParent(linked,rows,now),false);
    assert.ok(selectMedia(rows,'brand',{assets:[linked]},'active',now).every(a=>a.kind!=='menu'));
  }
  assert.deepEqual(bindMenus([menu],[],'homepage-hash'),[]);
  assert.equal(selectMedia([fair],'brand',{assets:[menu]},'active',now).length,1,'unbound legacy menus fail closed');
});

test('menu Last Known Good preserves original verification time for at most 48 hours',()=>{
  for(const [hours,shown] of [[0,true],[47,true],[49,false],[-1,false]]) {
    const a={...linked,checkedAt:new Date(+now-hours*3600000).toISOString()};
    assert.equal(selectMedia([fair],'brand',{assets:[a]},'active',now).some(a=>a.kind==='menu'),shown);
  }
  const next={...fair,id:'other',contentHash:'other-hash'};
  const shared=bindMenus([menu],[fair,next],'home')[0];
  assert.equal(hasCurrentParent(shared,[next],now),true);
  assert.equal(hasCurrentParent(shared,[{...next,contentHash:'changed'}],now),false);
});

test('semantic metadata promotes complete food courses then meal options, not ordinary ingredients',()=>{
  const make=(kind,title,rank)=>mediaSemantics({...menu,kind,title,rank,campaignId:fair.id,parentHash:fair.contentHash,imageUrl:`https://official.example/${rank}.jpg`});
  const assets=[make('detail','おすすめの鴨肉',60),make('detail','黒毛和牛 食べ放題',21),make('detail','九州黒豚 食べ放題',20),...bindMenus([make('menu','宴会コース',40),make('menu','豚肉2皿ランチ',35)],[fair],'home')];
  assert.deepEqual(selectMedia([fair],'brand',{assets},'active',now).map(a=>a.title),['秋フェア','九州黒豚 食べ放題','黒毛和牛 食べ放題','豚肉2皿ランチ','宴会コース','おすすめの鴨肉']);
  assert.equal(mediaSemantics(make('detail','鴨しゃぶコース以上をご注文で無料 きのこだし',30)).group,'dish');
});

test('portrait hero keeps food above meal options on phones and uses two semantic rows on Fold',()=>{
  // Actual verified proportions, independent of brand names and file paths.
  const items=[
    {ratio:1056/2492,kind:'campaign',group:'campaign',visualWeight:2,captionHeight:64},
    {ratio:768/531,kind:'detail',group:'course',visualWeight:1.5,captionHeight:88,minWidth:94},
    {ratio:768/583,kind:'detail',group:'course',visualWeight:1.5,captionHeight:88,minWidth:94},
    {ratio:584/360,kind:'menu',group:'related-meal',visualWeight:1.25,captionHeight:88,minWidth:94},
    {ratio:584/360,kind:'menu',group:'related-meal',visualWeight:1.25,captionHeight:64},
    {ratio:768/536,kind:'detail',group:'dish',captionHeight:64},
    {ratio:768/810,kind:'detail',group:'dish',captionHeight:64},
    {ratio:768/606,kind:'detail',group:'dish',captionHeight:64}
  ];
  for(const width of [354,394,646,776]){
    const p=planGallery(items,width),[lead,...other]=p.boxes;
    assert.equal(p.boxes.length,8);
    for(const b of other.slice(0,4))assert.ok(b.x>=lead.width+5,'featured images stay to the right');
    assert.ok(Math.max(...other.slice(0,2).map(b=>b.y+b.height))<=Math.min(...other.slice(2,4).map(b=>b.y))+1,'both courses precede both meal options');
    assert.ok(other[4].y>=lead.height+5,'individual dishes follow the complete featured panel');
    if(width>=600){assert.equal(other[0].y,other[1].y);assert.equal(other[2].y,other[3].y);}
  }
  for(const width of [244,284,324])for(const b of planGallery(items,width).boxes)assert.ok(b.width>=Math.min(width,items[b.index].minWidth||0));
});

test('semantic packing also handles 0–40 items without a four-image limit or empty cells',()=>{
  for(const width of [280,320,360,390,430,600,690,720,760,820,1024])for(let count=0;count<=40;count++){
    const items=Array.from({length:count},(_,i)=>({ratio:[.424,1.45,1.32,1.62,2.4][i%5],kind:i?'menu':'campaign',group:i?'related-meal':'campaign',visualWeight:i?1.25:2,captionHeight:i%2?88:64}));
    const p=planGallery(items,width);assert.equal(p.boxes.length,count);
    for(const [i,a]of p.boxes.entries()){
      assert.ok(a.width>0&&a.imageHeight>0);
      assert.ok(a.x>=-1e-6&&a.y>=-1e-6&&a.x+a.width<=width+1e-6&&a.y+a.height<=p.height+1e-6);
      assert.ok(Math.abs(a.width/a.imageHeight-items[i].ratio)<1e-6);
      for(const b of p.boxes.slice(i+1))assert.ok(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<1e-6||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<1e-6);
    }
    if(count){assert.ok(Math.abs(Math.max(...p.boxes.map(b=>b.x+b.width))-width)<1e-6);assert.ok(Math.abs(Math.max(...p.boxes.map(b=>b.y+b.height))-p.height)<1e-6);}
  }
});

test('fair count growth and shrinkage removes related menus as well as dish images',()=>{
  const rows=Array.from({length:40},(_,i)=>({...fair,id:'fair-'+i,contentHash:'hash-'+i,imageUrl:`https://official.example/fair-${i}.jpg`}));
  const assets=rows.flatMap(c=>bindMenus([{...menu,imageUrl:`https://official.example/menu-${c.id}.jpg`}],[c],'home'));
  for(const count of [0,1,2,5,12,40,7,3,0,6])assert.equal(selectMedia(rows.slice(0,count),'brand',{assets},'active',now).length,count*2);
});

test('current official data adopts semantic order without changing image URLs or price evidence',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../app/data/gallery.json',import.meta.url)));
  for(const a of data.assets){const b=mediaSemantics(a);assert.equal(b.imageUrl,a.imageUrl);assert.equal(b.title,a.title);assert.deepEqual(mediaCaption(b.title),mediaCaption(a.title));}
});
