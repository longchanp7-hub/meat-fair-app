import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const dataUrl=new URL('../app/data/offers.json',import.meta.url);
const reviewedUrl=new URL('./reviewed-offers.json',import.meta.url);
const MAX_REVIEW_AGE=2*86400000;
const now=Date.now();
const data=JSON.parse(await fs.readFile(dataUrl,'utf8'));
const reviewed=JSON.parse(await fs.readFile(reviewedUrl,'utf8'));
if(reviewed.schemaVersion!==1||!Array.isArray(reviewed.offers))throw Error('reviewed-offers.json schema is invalid');

const byBrand=new Map();
for(const o of data.offers||[]){
  if(!byBrand.has(o.brandId))byBrand.set(o.brandId,[]);
  byBrand.get(o.brandId).push(o);
}
for(const [brandId,rows] of Object.entries(Object.groupBy(reviewed.offers,o=>o.brandId))){
  const health=(data.sourceHealth||[]).find(h=>h.brandId===brandId);
  if((byBrand.get(brandId)||[]).length||health?.status==='ok')continue;
  const fresh=rows.filter(o=>{const t=Date.parse(o.reviewedAt||'');return Number.isFinite(t)&&now-t>=0&&now-t<=MAX_REVIEW_AGE;});
  for(const [rank,o] of fresh.entries()){
    const checkedAt=o.reviewedAt;
    data.offers.push({...o,checkedAt,rank,id:crypto.createHash('sha256').update([o.brandId,o.kind,o.title,o.priceText||'',o.officialUrl].join('|')).digest('hex').slice(0,16),verificationState:'reviewed_fallback'});
  }
  if(fresh.length&&health)Object.assign(health,{status:'last_known_good',offers:fresh.length,reviewedFallback:true});
}
await fs.writeFile(dataUrl,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({reviewedFallbacks:(data.offers||[]).filter(o=>o.verificationState==='reviewed_fallback').length},null,2));
