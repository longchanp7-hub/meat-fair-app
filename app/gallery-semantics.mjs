import {campaignStatus} from './status.mjs';

// Describe content, not a brand or a filename. Geometry remains in the planner.
export function mediaSemantics(asset) {
  const title=String(asset.title||'');
  let group='dish',priority=60,visualWeight=1;
  if(asset.kind==='campaign') {group='campaign';priority=0;visualWeight=2;}
  else if(asset.kind==='menu') {group='related-meal';priority=30;visualWeight=1.25;}
  else if(/食べ放題/.test(title)&&/牛|豚|和牛|黒豚|肉|蟹|かに|海鮮/.test(title)&&! /だし|つけだれ|以上をご注文|追加料金/.test(title)) {
    group='course';priority=20;visualWeight=1.5;
  }
  return {...asset,group,priority,visualWeight};
}

// Menus are supplementary to a verified, still-visible fair, not freestanding
// campaigns. Multiple parents let a shared menu survive only while a matching
// original parent remains. A new fair must never inherit an old menu by brand.
export function hasCurrentParent(asset,rows,now=new Date()) {
  const parents=asset.kind==='menu'?asset.parents:[{campaignId:asset.campaignId,parentHash:asset.parentHash}];
  if(!Array.isArray(parents)||!parents.length)return false;
  return parents.some(p=>p&&typeof p.campaignId==='string'&&typeof p.parentHash==='string'&&p.parentHash.length>0&&rows.some(c=>
    c.id===p.campaignId&&c.contentHash===p.parentHash&&(!c.brandId||!asset.brandId||c.brandId===asset.brandId)&&campaignStatus(c,now).state!=='ended'
  ));
}

export function bindMenus(assets,campaigns,sourceHash) {
  const parents=campaigns.filter(c=>typeof c.contentHash==='string'&&c.contentHash).map(c=>({campaignId:c.id,parentHash:c.contentHash}));
  if(!parents.length)return [];
  return assets.map(a=>({...a,parents,sourceHash}));
}

// Prefer a same-fair, in-page overview to an OGP/social preview. Never compare
// by month or brand alone: require a shared distinctive phrase in the official
// captions and matching parent evidence. Individual dishes cannot replace a fair.
export function pageOverview(campaign,main,details) {
  if(!/(?:^|[\/_-])(?:ogp|ogimage|og_image|og-image|ogp_image)(?:[_.-]|$)/i.test(String(main?.imageUrl||campaign.imageUrl||'')))return null;
  const meaningful=String(campaign.title||'').replace(/[【\[].*?[】\]]/g,'').replace(/フェア|キャンペーン|期間限定|平日|土日|アプリ|会員|限定|開催|半額|割引|食べ放題|お得/g,'');
  const phrases=[...meaningful.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{3,}/gu)].flatMap(m=>Array.from({length:m[0].length-2},(_,i)=>m[0].slice(i,i+3)));
  if(!phrases.length)return null;
  return details.find(a=>a.campaignId===campaign.id&&a.parentHash===campaign.contentHash&&/フェア|キャンペーン/.test(a.title||'')&&!/抽選|プレゼント|アンケート|フォロー/.test(a.title||'')&&phrases.some(p=>a.title.includes(p)))||null;
}
