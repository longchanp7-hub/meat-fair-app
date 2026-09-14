import fs from 'node:fs/promises';
import { SOURCES } from './source-registry.mjs';
import { canonicalUrl } from './fair-utils.mjs';
import { validateDataset } from './quality-gate.mjs';

const OUT=new URL('../app/data/fairs.json',import.meta.url);
const CANDIDATE=new URL('../app/data/candidates.json',import.meta.url);
const BASE_IDS=new Set(SOURCES.slice(0,4).map(x=>x.brandId));

await import('./update-fairs.mjs');

const data=JSON.parse(await fs.readFile(OUT,'utf8'));
const audit=JSON.parse(await fs.readFile(CANDIDATE,'utf8'));
const now=new Date();
const liveish=c=>!['ended_official','ended_by_date','stale_unverified'].includes(c.lifecycleStatus);
const recentEnded=c=>{
  if(c.lifecycleStatus!=='ended_by_date'||!c.endDate)return false;
  const age=(now-new Date(`${c.endDate}T23:59:59+09:00`))/86400000;
  return age>=0&&age<=120;
};

const sourceMeta=new Map();
for(const brand of SOURCES){
  for(const s of brand.sources||[]){
    sourceMeta.set(`${brand.brandId}|${canonicalUrl(s.url)}`,s);
  }
}

function applySourceMeta(c){
  const s=sourceMeta.get(`${c.brandId}|${canonicalUrl(c.officialUrl)}`);
  if(!s)return c;
  const out={...c};
  for(const k of ['startDate','endDate','endDateText','price','priceText','regionScope']){
    if(s[k]!==undefined&&s[k]!==null)out[k]=s[k];
  }
  if(Array.isArray(s.targetAreas))out.targetAreas=[...new Set(s.targetAreas)];
  if(Array.isArray(s.targetStores))out.targetStores=[...new Set(s.targetStores)];
  if(Array.isArray(s.conditions))out.conditions=[...new Set([...(out.conditions||[]),...s.conditions])];
  if(typeof s.allYouCanEat==='boolean')out.allYouCanEat=s.allYouCanEat;
  if(out.endDate&&new Date(`${out.endDate}T23:59:59+09:00`)<now){
    out.lifecycleStatus='ended_by_date';
    out.staleAfterDays=null;
  }else if(out.lifecycleStatus==='ended_by_date'&&(!out.endDate||new Date(`${out.endDate}T23:59:59+09:00`)>=now)){
    out.lifecycleStatus='current';
    out.staleAfterDays=60;
  }
  return out;
}

let production=[...(data.campaigns||[])];
const healthByBrand=new Map((audit.sourceHealth||[]).map(x=>[x.brandId,{...x}]));
const promoted=[];
const held=[];

for(const brand of SOURCES){
  if(BASE_IDS.has(brand.brandId))continue;
  const candidates=(audit.campaigns||[])
    .filter(c=>c.brandId===brand.brandId&&c.confidence>=0.72)
    .map(applySourceMeta);
  const live=candidates.filter(liveish);
  const keep=candidates.filter(c=>liveish(c)||recentEnded(c));
  const prev=production.filter(c=>c.brandId===brand.brandId);
  const hasTrustedLive=live.some(c=>c.sourceType==='campaign_detail'||c.imageUrl||c.endDate||c.startDate);
  const suspicious=candidates.length>25||live.length>12;
  const sourceHealthy=healthByBrand.get(brand.brandId)?.sourceOk!==false;

  if(sourceHealthy&&live.length>0&&hasTrustedLive&&!suspicious){
    production=production.filter(c=>c.brandId!==brand.brandId).concat(keep);
    promoted.push({brandId:brand.brandId,liveCount:live.length,productionCount:keep.length});
    healthByBrand.set(brand.brandId,{...(healthByBrand.get(brand.brandId)||{}),brandId:brand.brandId,action:'replace_audited',liveCandidateCount:live.length,previousLiveCount:prev.filter(liveish).length});
  }else{
    held.push({brandId:brand.brandId,reason:!sourceHealthy?'source_unhealthy':live.length===0?'no_live_candidates':!hasTrustedLive?'no_trusted_live_candidate':'suspicious_volume'});
    healthByBrand.set(brand.brandId,{...(healthByBrand.get(brand.brandId)||{}),brandId:brand.brandId,action:'lkg_hold'});
  }
}

const next={...data,updatedAt:audit.updatedAt||data.updatedAt,campaigns:production};
const gate=validateDataset(next);
if(gate.length)throw new Error(`post-promotion quality gate failed: ${gate.join(', ')}`);

const ids=new Set();
for(const c of next.campaigns){
  if(ids.has(c.id))throw new Error(`duplicate campaign id: ${c.id}`);
  ids.add(c.id);
}

await fs.writeFile(OUT,JSON.stringify(next,null,2));
await fs.writeFile(CANDIDATE,JSON.stringify({...audit,schemaVersion:16,sourceHealth:[...healthByBrand.values()],promotion:{promoted,held}},null,2));
console.log(JSON.stringify({promotion:{promoted,held},productionCount:next.campaigns.length},null,2));
