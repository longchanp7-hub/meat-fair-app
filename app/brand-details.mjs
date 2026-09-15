const DAY=86400000;
const PREMIUM=/黒毛和牛|霜降り|和牛|牛タン|厚切り|骨付き|国産牛|上カルビ|特選|プレミアム|大海老|大ホタテ|蟹|かに|カニ/;
const LOW_VALUE=/だし|たれ|薬味|サラダ|スープ|ごはん|ライス|デザート|ドリンク|ソフトクリーム/;

export function activeOffers(data,brandId,kind,now=new Date()){
  const rows=(Array.isArray(data?.offers)?data.offers:[]).filter(x=>x.brandId===brandId&&x.kind===kind);
  return rows.filter(x=>{
    const t=Date.parse(x.checkedAt||'');
    return Number.isFinite(t)&&+now-t>=0&&+now-t<=2*DAY;
  }).sort((a,b)=>{
    if(a.comparisonKey&&a.comparisonKey===b.comparisonKey&&Number.isFinite(a.price)&&Number.isFinite(b.price)&&a.price!==b.price)return a.price-b.price;
    return (a.rank??999)-(b.rank??999)||String(a.title||'').localeCompare(String(b.title||''),'ja');
  });
}

function currentAsset(asset,rows,now){
  const age=+now-Date.parse(asset.checkedAt||'');if(!(age>=0&&age<=2*DAY))return false;
  if(asset.kind==='detail')return rows.some(c=>c.id===asset.campaignId&&c.contentHash===asset.parentHash);
  if(asset.kind==='menu'){
    const parents=Array.isArray(asset.parents)?asset.parents:[];
    return parents.some(p=>rows.some(c=>c.id===p.campaignId&&c.contentHash===p.parentHash));
  }
  return false;
}

export function selectHighlights(mediaData,brandId,rows,now=new Date(),limit=2){
  const seen=new Set();
  return (Array.isArray(mediaData?.assets)?mediaData.assets:[])
    .filter(a=>a.brandId===brandId&&['detail','menu'].includes(a.kind)&&currentAsset(a,rows,now)&&PREMIUM.test(a.title||'')&&!LOW_VALUE.test(a.title||''))
    .map(a=>{
      let score=a.kind==='menu'?40:20;
      if(/黒毛和牛|霜降り|牛タン|骨付き|厚切り/.test(a.title||''))score+=20;
      if(/プレミアム|特選|国産牛/.test(a.title||''))score+=10;
      if(/食べ放題|コース/.test(a.title||''))score+=5;
      return {...a,score};
    })
    .sort((a,b)=>b.score-a.score||(a.rank??99)-(b.rank??99))
    .filter(a=>{const key=(a.title||'').replace(/\s+/g,' ').trim();if(!key||seen.has(key))return false;seen.add(key);return true;})
    .slice(0,limit);
}

export function selectPromotions(rows=[]){
  return rows.filter(c=>c.campaignType==='discount'||/予約|会員|クーポン|OFF|割引|半額|感謝祭/.test(c.title||''));
}

export function selectFairRows(rows=[]){
  const promos=new Set(selectPromotions(rows).map(c=>c.id));
  return rows.filter(c=>!promos.has(c.id));
}
