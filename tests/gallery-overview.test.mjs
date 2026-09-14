import test from 'node:test';
import assert from 'node:assert/strict';
import {pageOverview} from '../app/gallery-semantics.mjs';
import {planGallery} from '../app/gallery-plan.mjs';
import {selectMedia} from '../app/gallery.mjs';
const now=new Date('2026-09-15T09:00:00+09:00');
const fair={id:'fair',brandId:'brand',contentHash:'current',officialUrl:'https://official.example/fair/'};
const menu={brandId:'brand',officialUrl:fair.officialUrl,checkedAt:now.toISOString()};

test('same-fair official overview replaces duplicate social preview but never an unrelated campaign',()=>{
  const c={...fair,title:'【平日・アプリ会員限定】牛タン半額フェア',imageUrl:'https://official.example/fair/ogp.png'};
  const detail={...menu,kind:'detail',campaignId:c.id,parentHash:c.contentHash,title:'牛タンの日 牛タンフェア開催 単品も食べ放題もお得',imageUrl:'https://official.example/fair/poster.png'};
  assert.equal(pageOverview(c,null,[detail]),detail);
  assert.deepEqual(selectMedia([c],'brand',{assets:[detail]},'active',now).map(a=>[a.kind,a.imageUrl]),[['campaign',detail.imageUrl]]);
  for(const a of [{...detail,title:'牛タン抽選キャンペーン'},{...detail,title:'北海道フェア'},{...detail,parentHash:'changed'},{...detail,title:'特選牛タン'}])assert.equal(pageOverview(c,null,[a]),null);
  assert.equal(pageOverview({...c,imageUrl:'https://official.example/full.jpg'},null,[detail]),null);
});


test('narrow real-price constraints keep a portrait lead readable with all four companions',()=>{
  const items=[{ratio:1056/2492,kind:'campaign',group:'campaign',visualWeight:2,captionHeight:64},...[768/531,768/583,584/360,584/360].map((ratio,i)=>({ratio,kind:i<2?'detail':'menu',group:i<2?'course':'related-meal',visualWeight:i<2?1.5:1.25,captionHeight:i===3?64:88,minWidth:i===3?0:106}))];
  for(const width of [354,394]){
    const [lead,...rest]=planGallery(items,width).boxes;
    assert.ok(lead.width>=175);
    assert.ok(rest.every(b=>b.x>=lead.width+5));
  }
});
