// Preserve bounded reviewed fallback records and a very small set of explicit
// current official-price snippets that the richer catalog cannot otherwise pair.
// No inferred price is introduced here.
const validUrl=v=>{try{return new URL(v).protocol==='https:';}catch{return false;}};
const normalize=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'');
const REVIEWED_TTL=7*86400000,CURRENT_TTL=2*86400000;
export function reviewedCatalogFallbacks(data,brandId,current=[],now=new Date()){
 const result=[];
 for(const o of data?.offers||[]){
  const age=+now-Date.parse(o.checkedAt||o.reviewedAt),reviewed=o.verificationState==='reviewed_fallback',ttl=reviewed?REVIEWED_TTL:CURRENT_TTL;
  if(o.brandId!==brandId||!['course','drink'].includes(o.kind)||!(age>=0&&age<=ttl)||!validUrl(o.sourceUrl)||!validUrl(o.officialUrl))continue;
  const label=String(o.priceText||''),explicit=label.match(/税込\s*([\d,]+)\s*円/),n=explicit?Number(explicit[1].replaceAll(',','')):null;
  const included=/料金に含|無料/.test(label),amount=included?0:n;
  // しゃぶ葉の公式ページは「平日ディナー宴会 3,000円」を画像と本文に
  // 分けて掲載しているため、税込額が本文で明示された現在取得分だけ補完する。
  const currentExplicit=brandId==='syabuyo'&&o.kind==='course'&&/平日ディナー/.test(String(o.title||''))&&amount!==null;
  if(!reviewed&&!currentExplicit)continue;
  if(current.some(e=>e.kind===o.kind&&e.sourceUrl===o.sourceUrl&&normalize(e.title)===normalize(o.title)&&e.price?.amount!==null))continue;
  const evidence=String(o.rawText||[o.title,label,...o.conditions||[]].join(' '));
  const conditions=Array.isArray(o.conditions)?o.conditions:[];
  const title=currentExplicit?'【平日ディナー限定】宴会コース':o.title;
  result.push({id:(reviewed?'reviewed-':'explicit-')+o.id,brandId,kind:o.kind,title,
   officialUrl:o.officialUrl,sourceUrl:o.sourceUrl,checkedAt:o.checkedAt||o.reviewedAt,
   evidenceText:evidence,conditions,targetCourses:[],exclusive:false,
   price:{amount,text:label||null,taxIncluded:amount!==null?true:null,from:/[〜～]/.test(label),included},
   context:{service:conditions.find(x=>/ランチ|ディナー/.test(x))||(/平日ディナー/.test(o.title||'')?'ディナー':'未確認'),days:conditions.find(x=>/平日|土日|祝/.test(x))||(/平日/.test(o.title||'')?'平日':'未確認'),audience:conditions.find(x=>/大人|小学生/.test(x))||'未確認',scope:o.comparisonKey||o.sourceUrl,charge:o.kind==='drink'?'飲み物料金':'コース料金'},
   comparisonKey:(reviewed?'reviewed|':'explicit|')+(o.comparisonKey||o.id),comparisonEvidence:reviewed?'existing-reviewed-context':'explicit-current-official-price',
   imageUrl:null,width:null,height:null,rank:o.rank||0,campaignId:null,parentHash:null,
   verificationState:reviewed?'last_known_good':'confirmed',sourceMethod:reviewed?'existing-reviewed-fallback':'official-explicit-price-fallback'});
 }
 return result;
}
