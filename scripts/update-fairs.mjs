import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { SOURCES } from './source-registry.mjs';
import { validateDataset, validateCampaign } from './quality-gate.mjs';
import { linksFromHtml,relevantTitle,allowedPath,campaignId,textFromHtml,titleFromHtml,dateFields,imageFromHtml,deriveFields,canonicalUrl } from './fair-utils.mjs';

const OUT=new URL('../app/data/fairs.json',import.meta.url);
const CANDIDATE=new URL('../app/data/candidates.json',import.meta.url);
async function fetchText(url){const r=await fetch(url,{headers:{'user-agent':'meat-fair-app/0.2 (+github-actions)'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}

const now=new Date().toISOString();
let current={schemaVersion:1,updatedAt:null,timezone:'Asia/Tokyo',statusRules:{newDays:7,endingSoonDays:7},campaigns:[]};
try{current=JSON.parse(await fs.readFile(OUT,'utf8'))}catch{}
const previous=new Map((current.campaigns||[]).map(c=>[`${c.brandId}|${canonicalUrl(c.officialUrl)}`,c]));
const candidates=[];const errors=[];const sourceOk=new Set();

for(const brand of SOURCES.slice(0,4)){
  for(const source of brand.sources){
    try{
      const indexHtml=await fetchText(source.url);sourceOk.add(brand.brandId);
      const map=new Map();for(const l of linksFromHtml(indexHtml,source.url)){if(allowedPath(brand.brandId,l.url)&&!map.has(l.url))map.set(l.url,l)}
      for(const link of [...map.values()].slice(0,30)){
        try{
          const html=await fetchText(link.url);const text=textFromHtml(html);const detailTitle=titleFromHtml(html)||link.title;if(!relevantTitle(detailTitle))continue;
          const d=dateFields(text);const x=deriveFields(detailTitle,text);const officialUrl=canonicalUrl(link.url);const old=previous.get(`${brand.brandId}|${officialUrl}`);
          const c={id:campaignId(brand.brandId,officialUrl),brandId:brand.brandId,brandName:brand.name,title:detailTitle,officialUrl,sourceUrl:source.url,sourceType:source.type,campaignType:x.campaignType,priority:x.priority,startDate:d.startDate,startDateText:null,endDate:d.endDate,endDateText:d.endDateText,price:x.price,priceText:x.priceText,allYouCanEat:x.allYouCanEat,targetCourses:[],targetStores:[],targetAreas:[],regionScope:x.regionScope,limitedIngredients:x.limitedIngredients,weekdayCondition:x.weekdayCondition,conditions:[],imageUrl:imageFromHtml(html,officialUrl),firstSeenAt:old?.firstSeenAt||now,fetchedAt:now,lastVerifiedAt:now,confidence:(d.startDate||d.endDate||/期間限定|フェア|キャンペーン|コラボ|価格改定/.test(text))?0.9:0.72,contentHash:crypto.createHash('sha256').update(text.slice(0,20000)).digest('hex')};
          if(!validateCampaign(c).length)candidates.push(c);
        }catch(e){errors.push({brandId:brand.brandId,url:link.url,error:String(e.message||e)})}
      }
    }catch(e){errors.push({brandId:brand.brandId,url:source.url,error:String(e.message||e)})}
  }
}

const dedup=[...new Map(candidates.map(c=>[`${c.brandId}|${c.officialUrl}`,c])).values()];
await fs.writeFile(CANDIDATE,JSON.stringify({schemaVersion:2,updatedAt:now,campaigns:dedup,errors},null,2));
let production=[...(current.campaigns||[])];
for(const brand of SOURCES.slice(0,4)){
  const fresh=dedup.filter(c=>c.brandId===brand.brandId&&c.confidence>=0.72);
  if(sourceOk.has(brand.brandId)&&fresh.length)production=production.filter(c=>c.brandId!==brand.brandId).concat(fresh);
  else if(sourceOk.has(brand.brandId))errors.push({brandId:brand.brandId,error:'no_verified_candidates_using_lkg'});
}
const next={...current,updatedAt:now,campaigns:production};const gate=validateDataset(next);if(gate.length)throw new Error(`quality gate failed: ${gate.join(', ')}`);
await fs.writeFile(OUT,JSON.stringify(next,null,2));
console.log(JSON.stringify({candidateCount:dedup.length,errorCount:errors.length,productionCount:next.campaigns.length,sourceOk:[...sourceOk]},null,2));
