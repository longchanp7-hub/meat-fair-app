import crypto from 'node:crypto';
import {parseHtml,text} from './html-document.mjs';

export const ROAN_DINNER_URL='https://ameblo.jp/0141roan/entry-12977830217.html';
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');

function entry({title,kind='course',amount,priceText,days,checkedAt,evidence,rank}){
  return {
    id:hash(['roan',kind,title,priceText,ROAN_DINNER_URL].join('|')).slice(0,20),
    brandId:'roan',kind,title,officialUrl:ROAN_DINNER_URL,sourceUrl:ROAN_DINNER_URL,
    sourceHash:hash(evidence),checkedAt,evidenceText:evidence,evidenceHash:hash(evidence),
    price:{amount,text:priceText,taxIncluded:true,from:false,...(amount===0?{included:true}:{})},
    context:{service:'ディナー',days,audience:'大人',channel:'通常掲載',charge:kind==='drink'?'飲み物料金':'コース料金',subBrand:'',scope:'roan-dinner-current'},
    comparisonKey:'roan-dinner-current|'+days+'|'+kind,comparisonEvidence:'reviewed-current-official-blog',
    conditions:[days,'ドリンクバー・デザート食べ放題付き'],targetCourses:[],exclusive:false,scopeLabel:null,imageUrl:null,width:null,height:null,rank,
    campaignId:null,parentHash:null,verificationState:'confirmed',planExistence:'confirmed',sourceMethod:'reviewed-current-roan-dinner'
  };
}

export function reviewedRoanCatalog(url,html,checkedAt){
  if(new URL(url).href!==ROAN_DINNER_URL)return[];
  const body=text(parseHtml(html)),n=body.normalize('NFKC').replace(/\s+/g,'');
  if(!n.includes('旬菜ビュッフェディナー')||!n.includes('税込2,880円')||!n.includes('税込2,980円')||!n.includes('ドリンクバー')||!n.includes('デザート食べ放題付き'))return[];
  return [
    entry({title:'旬菜ビュッフェ ディナー（平日）',amount:2880,priceText:'税込2,880円',days:'平日',checkedAt,evidence:'公式ブログ：旬菜ビュッフェ ディナー 平日 大人 税込2,880円。ドリンクバー・デザート食べ放題付き。',rank:0}),
    entry({title:'旬菜ビュッフェ ディナー（土日祝）',amount:2980,priceText:'税込2,980円',days:'土日祝',checkedAt,evidence:'公式ブログ：旬菜ビュッフェ ディナー 土日祝 大人 税込2,980円。ドリンクバー・デザート食べ放題付き。',rank:1}),
    entry({title:'ドリンクバー（旬菜ビュッフェディナーに含む）',kind:'drink',amount:0,priceText:'コース料金に含む',days:'全日',checkedAt,evidence:'公式ブログ：平日・土日祝の旬菜ビュッフェディナーはいずれもドリンクバー・デザート食べ放題付き。',rank:0})
  ];
}

export function reconcileRoanCatalog(entries){
  const reviewed=entries.filter(e=>e.brandId==='roan'&&e.sourceMethod==='reviewed-current-roan-dinner');
  if(reviewed.filter(e=>e.kind==='course').length!==2)return entries;
  return entries.filter(e=>e.sourceUrl!==ROAN_DINNER_URL||e.sourceMethod==='reviewed-current-roan-dinner');
}
