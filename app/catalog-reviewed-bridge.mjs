// Preserve bounded, explicitly reviewed fallback records from the current main.
// Automatic unscoped offer snippets are not imported into the richer catalog.
// A review is never upgraded to a fresh network verification.
const validUrl=v=>{try{return new URL(v).protocol==='https:';}catch{return false;}};
const normalize=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'');
export function reviewedCatalogFallbacks(data,brandId,current=[],now=new Date()){
 const result=[];
 for(const o of data?.offers||[]){
  const age=+now-Date.parse(o.checkedAt||o.reviewedAt);
  if(o.brandId!==brandId||o.verificationState!=='reviewed_fallback'||!['course','drink'].includes(o.kind)||!(age>=0&&age<=172800000)||!validUrl(o.sourceUrl)||!validUrl(o.officialUrl))continue;
  if(current.some(e=>e.kind===o.kind&&e.sourceUrl===o.sourceUrl&&normalize(e.title)===normalize(o.title)))continue;
  const label=String(o.priceText||''),explicit=label.match(/税込\s*([\d,]+)\s*円/),n=explicit?Number(explicit[1].replaceAll(',','')):null;
  const included=/料金に含|無料/.test(label),amount=included?0:n;
  const evidence=String(o.rawText||[o.title,label,...o.conditions||[]].join(' '));
  const conditions=Array.isArray(o.conditions)?o.conditions:[];
  result.push({id:'reviewed-'+o.id,brandId,kind:o.kind,title:o.title,
   officialUrl:o.officialUrl,sourceUrl:o.sourceUrl,checkedAt:o.checkedAt||o.reviewedAt,
   evidenceText:evidence,conditions,targetCourses:[],exclusive:false,
   price:{amount,text:label||null,taxIncluded:amount!==null?true:null,from:/[〜～]/.test(label),included},
   context:{service:conditions.find(x=>/ランチ|ディナー/.test(x))||'未確認',days:conditions.find(x=>/平日|土日|祝/.test(x))||'未確認',audience:conditions.find(x=>/大人|小学生/.test(x))||'未確認',scope:o.comparisonKey||o.sourceUrl,charge:o.kind==='drink'?'飲み物料金':'コース料金'},
   comparisonKey:'reviewed|'+(o.comparisonKey||o.id),comparisonEvidence:'existing-reviewed-context',
   imageUrl:null,width:null,height:null,rank:o.rank||0,campaignId:null,parentHash:null,
   verificationState:'last_known_good',sourceMethod:'existing-reviewed-fallback'});
 }
 return result;
}
