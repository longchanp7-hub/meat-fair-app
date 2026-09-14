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
