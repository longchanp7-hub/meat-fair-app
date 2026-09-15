const DAY=86400000;
const PREMIUM=/黒毛和牛|霜降り|和牛|牛タン|厚切り|骨付き|国産牛|上カルビ|特選|プレミアム|大海老|大ホタテ|蟹|かに|カニ/;
const LOW_VALUE=/だし|たれ|薬味|サラダ|スープ|ごはん|ライス|デザート|ドリンク|ソフトクリーム/;
const OFFER_NOISE=/お知らせ|Previous|Next|価格改定|クーポン廃止|学生限定|学生専用|学生応援|キャンペーン|フェア|ご注意|おかわり|グループ全員|平素は|詳しくはこちら|こちらから|一覧/;

function usefulOffer(row,kind){
  const title=String(row.title||'').replace(/\s+/g,' ').trim();
  if(!title||OFFER_NOISE.test(title))return false;
  if(kind==='course'){
    if(row.priceText)return title.length<=125;
    if(title.length>58)return false;
    if(/^(?:食べ放題|焼肉食べ放題|食べ放題コース|メニュー［食べ放題］)$/.test(title))return false;
    return /(?:食べ放題|ビュッフェ|バイキング).*(?:コース|ランチ)|(?:コース|ランチ).*(?:食べ放題|ビュッフェ|バイキング)/.test(title);
  }
  if(kind==='drink'){
    if(row.priceText)return title.length<=125;
    return title.length<=55&&/飲み放題|ドリンクバー/.test(title);
  }
  return false;
}
function offerScore(row,kind){
  const title=String(row.title||'');
  let score=row.priceText?100:0;
  if(title.length<=42)score+=22;else if(title.length<=70)score+=10;else score-=10;
  if(kind==='course'&&/\d+\s*品|黒毛和牛|牛タン|プレミアム|ランチ/.test(title))score+=8;
  if(kind==='drink'&&/ラストオーダー|\d+分|アルコール|ソフトドリンク/.test(title))score+=8;
  return score;
}

export function activeOffers(data,brandId,kind,now=new Date()){
  const rows=(Array.isArray(data?.offers)?data.offers:[]).filter(x=>x.brandId===brandId&&x.kind===kind).filter(x=>{
    const t=Date.parse(x.checkedAt||'');
    return Number.isFinite(t)&&+now-t>=0&&+now-t<=2*DAY&&usefulOffer(x,kind);
  });
  // When the official source exposes explicit tax-inclusive amounts, do not
  // dilute a price section with descriptive or duplicate no-price snippets.
  const priced=rows.filter(x=>x.priceText);
  const pool=priced.length?priced:rows;
  const seen=new Set();
  return pool.sort((a,b)=>{
    const score=offerScore(b,kind)-offerScore(a,kind);if(score)return score;
    if(a.comparisonKey&&a.comparisonKey===b.comparisonKey&&Number.isFinite(a.price)&&Number.isFinite(b.price)&&a.price!==b.price)return a.price-b.price;
    return (a.rank??999)-(b.rank??999)||String(a.title||'').localeCompare(String(b.title||''),'ja');
  }).filter(x=>{
    const key=String(x.title||'').replace(/\s+/g,' ').replace(/[!！。]/g,'').trim();
    if(seen.has(key))return false;seen.add(key);return true;
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
    .filter(a=>a.brandId===brandId&&['detail','menu'].includes(a.kind)&&currentAsset(a,rows,now)&&PREMIUM.test(a.title||'')&&!LOW_VALUE.test(a.title||'')&&!/ランチメニュー|宴会|ニュース|価格|料金/.test(a.title||''))
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
