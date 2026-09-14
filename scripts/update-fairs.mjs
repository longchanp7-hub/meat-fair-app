import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { SOURCES } from './source-registry.mjs';
import { validateDataset, validateCampaign } from './quality-gate.mjs';
import { linksFromHtml,rawDetailUrls,relevantTitle,allowedPath,campaignId,textFromHtml,titleFromHtml,dateFields,imageCandidatesFromHtml,deriveFields,canonicalUrl,firstDate,lifecycleFields,targetCoursesFromText } from './fair-utils.mjs';

const OUT=new URL('../app/data/fairs.json',import.meta.url);
const CANDIDATE=new URL('../app/data/candidates.json',import.meta.url);
async function fetchText(url){const r=await fetch(url,{headers:{'user-agent':'meat-fair-app/0.2 (+github-actions)'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}
const auxCache=new Map();
async function fetchCached(url){if(!auxCache.has(url))auxCache.set(url,fetchText(url));return await auxCache.get(url)}
async function selectFoodImage(brandId,html,officialUrl,title){
  const candidates=imageCandidatesFromHtml(html,officialUrl,{title}).map(c=>({...c,source:'detail'}));
  const links=linksFromHtml(html,officialUrl);
  const extras=[];
  if(brandId==='yuzuan'){
    for(const x of links.filter(x=>new URL(x.url).pathname==='/seasonal/'||new URL(x.url).pathname.startsWith('/seasonal/')).slice(0,2))extras.push(x.url);
  }else if(brandId==='yakiniku-king'&&!new URL(officialUrl).pathname.startsWith('/menu_all/season/')){
    const x=links.find(x=>/\/menu_all\/season\/[A-Za-z0-9_-]+\/?$/.test(new URL(x.url).pathname));if(x)extras.push(x.url);
  }
  for(const url of [...new Set(extras)]){
    try{const linkedHtml=await fetchCached(url);for(const c of imageCandidatesFromHtml(linkedHtml,url,{title}))candidates.push({...c,score:c.score+5,source:'campaign-page'})}catch{}
  }
  const bestByUrl=new Map();for(const c of candidates){const old=bestByUrl.get(c.url);if(!old||c.score>old.score)bestByUrl.set(c.url,c)}
  const best=[...bestByUrl.values()].sort((a,b)=>b.score-a.score)[0];return best&&best.score>=5?best.url:null;
}
function titleKey(s=''){return s.replace(/20\d{2}年\d{1,2}月\d{1,2}日[^「『]*/g,'').replace(/焼肉きんぐ|牛角|しゃぶ葉|ゆず庵/g,'').replace(/期間限定|販売開始|発売開始|開催します|開催|フェア/g,'').replace(/[\s　!！?？。、・「」『』（）()\-~〜～]/g,'').trim()}
function richer(a,b){const score=c=>(c.sourceType==='seasonal_index'?5:0)+(c.endDate?3:0)+(c.startDate?2:0)+(c.imageUrl?1:0)+(c.targetCourses?.length||0)+(c.limitedIngredients?.length||0)/10;return score(a)>=score(b)?a:b}
function semanticDedup(list){const out=[];for(const c of list){let hit=-1;for(let i=0;i<out.length;i++){const x=out[i];if(x.brandId!==c.brandId||!x.startDate||x.startDate!==c.startDate)continue;if(!['P1','P2'].includes(x.priority)||!['P1','P2'].includes(c.priority))continue;const a=titleKey(x.title),b=titleKey(c.title);if(a.length>=4&&b.length>=4&&(a.includes(b)||b.includes(a))){hit=i;break}}if(hit<0){out.push({...c,secondarySources:c.secondarySources||[]});continue}const old=out[hit],keep=richer(old,c),other=keep===old?c:old;const secondary=[...(keep.secondarySources||[]),{url:other.officialUrl,type:other.sourceType,title:other.title},...(other.secondarySources||[])];out[hit]={...keep,secondarySources:[...new Map(secondary.map(s=>[s.url,s])).values()]}}return out}

const nowIso=new Date().toISOString();const now=new Date();
let current={schemaVersion:1,updatedAt:null,timezone:'Asia/Tokyo',statusRules:{newDays:7,endingSoonDays:7},campaigns:[]};
try{current=JSON.parse(await fs.readFile(OUT,'utf8'))}catch{}
const previous=new Map((current.campaigns||[]).map(c=>[`${c.brandId}|${canonicalUrl(c.officialUrl)}`,c]));
const candidates=[];const errors=[];const sourceOk=new Set();

for(const brand of SOURCES.slice(0,4)){
  for(const source of brand.sources){
    try{
      const indexHtml=await fetchText(source.url);sourceOk.add(brand.brandId);
      const map=new Map();const discovered=[...linksFromHtml(indexHtml,source.url),...rawDetailUrls(brand.brandId,indexHtml,source.url)];for(const l of discovered){if(allowedPath(brand.brandId,l.url)&&!map.has(l.url))map.set(l.url,l)}
      for(const link of [...map.values()].slice(0,24)){
        try{
          const html=await fetchText(link.url);const text=textFromHtml(html);const detailTitle=titleFromHtml(html)||link.title;if(!relevantTitle(detailTitle))continue;
          const d=dateFields(text);const x=deriveFields(detailTitle,text);const publishedDate=firstDate(text);const life=lifecycleFields({text,startDate:d.startDate,endDate:d.endDate,publishedDate,campaignType:x.campaignType,now});const officialUrl=canonicalUrl(link.url);const old=previous.get(`${brand.brandId}|${officialUrl}`);const imageUrl=await selectFoodImage(brand.brandId,html,officialUrl,detailTitle);
          const c={id:campaignId(brand.brandId,officialUrl),brandId:brand.brandId,brandName:brand.name,title:detailTitle,officialUrl,sourceUrl:source.url,sourceType:source.type,campaignType:x.campaignType,priority:x.priority,startDate:d.startDate,startDateText:null,endDate:d.endDate,endDateText:d.endDateText,publishedDate,price:x.price,priceText:x.priceText,allYouCanEat:x.allYouCanEat,targetCourses:targetCoursesFromText(brand.brandId,text),targetStores:[],targetAreas:[],regionScope:x.regionScope,limitedIngredients:x.limitedIngredients,weekdayCondition:x.weekdayCondition,conditions:[],imageUrl,lifecycleStatus:life.lifecycleStatus,staleAfterDays:life.staleAfterDays,firstSeenAt:old?.firstSeenAt||nowIso,fetchedAt:nowIso,lastVerifiedAt:nowIso,confidence:(d.startDate||d.endDate||/期間限定|フェア|キャンペーン|コラボ|価格改定/.test(text))?0.9:0.72,contentHash:crypto.createHash('sha256').update(text.slice(0,20000)).digest('hex')};
          if(!validateCampaign(c).length)candidates.push(c);
        }catch(e){errors.push({brandId:brand.brandId,url:link.url,error:String(e.message||e)})}
      }
    }catch(e){errors.push({brandId:brand.brandId,url:source.url,error:String(e.message||e)})}
  }
}

const urlDedup=[...new Map(candidates.map(c=>[`${c.brandId}|${c.officialUrl}`,c])).values()];
const dedup=semanticDedup(urlDedup);
await fs.writeFile(CANDIDATE,JSON.stringify({schemaVersion:6,updatedAt:nowIso,campaigns:dedup,errors},null,2));
let production=[...(current.campaigns||[])];
for(const brand of SOURCES.slice(0,4)){
  const fresh=dedup.filter(c=>c.brandId===brand.brandId&&c.confidence>=0.72);
  if(sourceOk.has(brand.brandId)&&fresh.length)production=production.filter(c=>c.brandId!==brand.brandId).concat(fresh);
  else if(sourceOk.has(brand.brandId))errors.push({brandId:brand.brandId,error:'no_verified_candidates_using_lkg'});
}
const next={...current,updatedAt:nowIso,campaigns:production};const gate=validateDataset(next);if(gate.length)throw new Error(`quality gate failed: ${gate.join(', ')}`);
await fs.writeFile(OUT,JSON.stringify(next,null,2));
console.log(JSON.stringify({candidateCount:dedup.length,errorCount:errors.length,productionCount:next.campaigns.length,sourceOk:[...sourceOk]},null,2));
