import crypto from 'node:crypto';
import {parseHtml,text} from './html-document.mjs';

export const ANRAKUTEI_PRICE_NOTICE='https://anrakutei.jp/topic/20260917pricedown/';
const rows=[
  {title:'スタンダードコース',net:3280,gross:3608,oldTitle:'ベーシックコース'},
  {title:'デラックスコース',net:4680,gross:5148},
  {title:'プライムコース',net:6980,gross:7678},
  {title:'プレミアムゴージャスコース',net:9800,gross:10780}
];
const oldPrices=new Map([
  ['ベーシックコース',4048],['スタンダードコース',4048],['デラックスコース',5478],['プライムコース',8008],['プレミアムゴージャスコース',16500]
]);
const coreTitle=/^(?:ベーシック|スタンダード|デラックス|プライム|プレミアムゴージャス)コース$/;
const norm=v=>String(v||'').normalize('NFKC').replace(/[\s,，]/g,'');
const digest=v=>crypto.createHash('sha256').update(String(v)).digest('hex');

export function reviewedAnrakuteiCatalog(url,html,checkedAt){
  if(new URL(url).href!==ANRAKUTEI_PRICE_NOTICE)return[];
  const body=text(parseHtml(html)),n=norm(body);
  if(!n.includes('2026年9月17日')||!n.includes('ソフトドリンク飲み放題')||!n.includes('追加料金なし'))return[];
  for(const r of rows){
    if(!n.includes(norm(r.title))||!n.includes(norm(`税込${r.gross}円`))||!n.includes(norm(`${r.net}円`)))return[];
  }
  const sourceHash=digest(body);
  const base={brandId:'anrakutei',officialUrl:ANRAKUTEI_PRICE_NOTICE,sourceUrl:ANRAKUTEI_PRICE_NOTICE,sourceHash,checkedAt,
    targetCourses:[],exclusive:false,scopeLabel:null,imageUrl:null,width:null,height:null,campaignId:null,parentHash:null,
    verificationState:'confirmed',planExistence:'confirmed',sourceMethod:'reviewed-effective-price-notice'};
  const courses=rows.map((r,rank)=>{
    const evidenceText=`${r.title} 新価格 ${r.net.toLocaleString('ja-JP')}円（税込${r.gross.toLocaleString('ja-JP')}円） 価格改定日 2026年9月17日 全コースソフトドリンク飲み放題付き`;
    return {...base,id:`anrakutei-20260917-${rank}`,kind:'course',title:r.title,evidenceText,evidenceHash:digest(evidenceText),
      price:{amount:r.gross,text:`税込${r.gross.toLocaleString('ja-JP')}円`,taxIncluded:true,from:false},
      context:{service:'食べ放題',days:'公式掲載条件',audience:'大人',channel:'通常掲載',charge:'コース料金',subBrand:'',scope:'anrakutei-20260917-core'},
      comparisonKey:`anrakutei-20260917-core|${r.title}`,comparisonEvidence:'official-effective-price-notice',conditions:['2026年9月17日からの新価格','ソフトドリンク飲み放題を追加料金なしで含む'],rank};
  });
  const drinkText='全食べ放題コース ソフトドリンク飲み放題 追加料金なし（2026年9月17日から）';
  courses.push({...base,id:'anrakutei-20260917-softdrink',kind:'drink',title:'ソフトドリンク飲み放題（食べ放題コースに含む）',evidenceText:drinkText,evidenceHash:digest(drinkText),
    price:{amount:0,text:'コース料金に含む',taxIncluded:true,from:false,included:true},
    context:{service:'食べ放題',days:'公式掲載条件',audience:'大人',channel:'通常掲載',charge:'飲み物料金',subBrand:'',scope:'anrakutei-20260917-drink'},
    comparisonKey:'anrakutei-20260917-drink',comparisonEvidence:'official-effective-price-notice',conditions:['全食べ放題コース対象','2026年9月17日から追加料金なし'],rank:0});
  return courses;
}

export function reconcileAnrakuteiCatalog(entries){
  const reviewed=entries.filter(e=>e.brandId==='anrakutei'&&e.sourceMethod==='reviewed-effective-price-notice');
  if(reviewed.filter(e=>e.kind==='course').length!==4)return entries;
  const auto=entries.filter(e=>e.brandId==='anrakutei'&&e.kind==='course'&&/\/menucate\/tabehoudai\/?$/.test(e.sourceUrl||'')&&coreTitle.test(e.title||''));
  const currentMap=new Map(auto.filter(e=>Number.isFinite(e.price?.amount)).map(e=>[e.title,e.price.amount]));
  const hasFourCurrent=['スタンダードコース','デラックスコース','プライムコース','プレミアムゴージャスコース'].every(t=>currentMap.has(t));
  const currentIsOld=auto.length>0&&auto.every(e=>!Number.isFinite(e.price?.amount)||oldPrices.get(e.title)===e.price.amount);
  if(hasFourCurrent&&!currentIsOld){
    // A complete newer menu supersedes the notice for course prices. The notice's
    // separate soft-drink inclusion remains valid until newer official evidence contradicts it.
    return entries.filter(e=>!(e.sourceMethod==='reviewed-effective-price-notice'&&e.kind==='course'));
  }
  return entries.filter(e=>!(e.brandId==='anrakutei'&&e.kind==='course'&&coreTitle.test(e.title||'')&&e.sourceMethod!=='reviewed-effective-price-notice'));
}
