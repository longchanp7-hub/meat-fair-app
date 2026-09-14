import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { SOURCES, INCLUDE_KEYWORDS, EXCLUDE_KEYWORDS } from './source-registry.mjs';
import { validateDataset } from './quality-gate.mjs';

const OUT = new URL('../app/data/fairs.json', import.meta.url);
const CANDIDATE = new URL('../app/data/candidates.json', import.meta.url);

function stripTags(s='') { return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); }
function abs(base, href) { try { return new URL(href, base).href; } catch { return null; } }
function linksFromHtml(html, base) {
  const out=[]; const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))) { const title=stripTags(m[2]); const url=abs(base,m[1]); if(title&&url) out.push({title,url}); }
  return out;
}
function relevant(title) {
  if (EXCLUDE_KEYWORDS.some(k=>title.includes(k))) return false;
  return INCLUDE_KEYWORDS.some(k=>title.includes(k));
}
function idFor(brandId,url,title){return crypto.createHash('sha1').update(`${brandId}|${url}|${title}`).digest('hex').slice(0,16);}

async function fetchText(url){ const r=await fetch(url,{headers:{'user-agent':'meat-fair-app/0.1 (+github-actions)'}}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }

const now=new Date().toISOString();
const candidates=[]; const errors=[];
for (const brand of SOURCES.slice(0,4)) {
  for (const source of brand.sources) {
    try {
      const html=await fetchText(source.url);
      const links=linksFromHtml(html,source.url).filter(x=>relevant(x.title));
      for (const l of links) candidates.push({
        id:idFor(brand.brandId,l.url,l.title), brandId:brand.brandId, brandName:brand.name,
        title:l.title, officialUrl:l.url, sourceUrl:source.url, sourceType:source.type,
        campaignType:'other', priority:'P3', startDate:null, startDateText:null, endDate:null, endDateText:null,
        price:null, priceText:null, allYouCanEat:null, targetCourses:[], targetStores:[], targetAreas:[],
        regionScope:'unknown', limitedIngredients:[], weekdayCondition:null, conditions:[], imageUrl:null,
        firstSeenAt:now, fetchedAt:now, lastVerifiedAt:now, confidence:0.55,
        contentHash:crypto.createHash('sha256').update(`${l.title}|${l.url}`).digest('hex')
      });
    } catch (e) { errors.push({brandId:brand.brandId,url:source.url,error:String(e.message||e)}); }
  }
}

const dedup=[...new Map(candidates.map(x=>[`${x.brandId}|${x.officialUrl}`,x])).values()];
await fs.writeFile(CANDIDATE, JSON.stringify({schemaVersion:1,updatedAt:now,campaigns:dedup,errors},null,2));

let current={schemaVersion:1,updatedAt:null,timezone:'Asia/Tokyo',statusRules:{newDays:7,endingSoonDays:7},campaigns:[]};
try{current=JSON.parse(await fs.readFile(OUT,'utf8'));}catch{}
current.updatedAt=now;
const gate=validateDataset(current);
if(gate.length) throw new Error(`quality gate failed: ${gate.join(', ')}`);
await fs.writeFile(OUT,JSON.stringify(current,null,2));
console.log(JSON.stringify({candidateCount:dedup.length,errorCount:errors.length,productionCount:current.campaigns.length},null,2));
