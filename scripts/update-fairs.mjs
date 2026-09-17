import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {SOURCES} from './source-registry.mjs';
import {TARGET_BRANDS} from './target-brands.mjs';
import {reviewSemanticallySupported} from './review-guard.mjs';
import {validateDataset,validateCampaign} from './quality-gate.mjs';
import {campaignId} from './fair-utils.mjs';
import {parseHtml,text,httpUrl,all} from './html-document.mjs';
import {extractPage,discoverLinks,allowedDetail,datesFor,selectImage,dedupCampaigns,FOOD_TITLE,NON_FOOD,ENDED} from './site-profiles.mjs';
import {withFetchRetries} from './retry-fetch.mjs';

const OUT=new URL('../app/data/fairs.json',import.meta.url);
const AUDIT=new URL('../app/data/candidates.json',import.meta.url);
const primaryCatalog=JSON.parse(await fs.readFile(new URL('./reviewed-campaigns.json',import.meta.url),'utf8'));
const liveCatalog=JSON.parse(await fs.readFile(new URL('./reviewed-campaigns-live.json',import.meta.url),'utf8'));
let roanCatalog={reviews:[]};
try{roanCatalog=JSON.parse(await fs.readFile(new URL('./reviewed-campaigns-roan.json',import.meta.url),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;}
const reviewMap=new Map();
for(const r of [...(liveCatalog.reviews||[]),...(primaryCatalog.reviews||[]),...(roanCatalog.reviews||[])]){
  if(!TARGET_BRANDS.has(r.brandId))continue;
  const key=r.brandId+'|'+r.officialUrl;
  if(!reviewMap.has(key))reviewMap.set(key,r);
}
const catalog={schemaVersion:1,reviews:[...reviewMap.values()]};
const now=new Date(),stamp=now.toISOString(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const DAY=86400000;
let current={schemaVersion:1,timezone:'Asia/Tokyo',statusRules:{newDays:7,endingSoonDays:7},campaigns:[]};
try{current=JSON.parse(await fs.readFile(OUT,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;}
const cache=new Map();
async function fetchPage(url,brand){
  if(!cache.has(url))cache.set(url,withFetchRetries(async()=>{
    const r=await fetch(url,{headers:{'user-agent':'meat-fair-app/1.0 (+https://github.com/longchanp7-hub/meat-fair-app)','accept':'text/html,application/xhtml+xml','accept-language':'ja,en;q=0.8'},signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const finalUrl=httpUrl(r.url||url,url);
    const hosts=new Set(brand.sources.map(s=>new URL(s.url).hostname));
    if(!hosts.has(new URL(finalUrl).hostname))throw Error('unexpected_redirect_host');
    const html=await r.text();
    if(text(parseHtml(html)).length<50)throw Error('unreadable_or_script_only_page');
    return{html,finalUrl};
  },{attempts:3,delayMs:300}));
  return await cache.get(url);
}
function periodState(c){if(['ended_official','stale_unverified'].includes(c.lifecycleStatus))return c.lifecycleStatus;if(ENDED.test(c.title))return'ended_official';if(c.endDate&&c.endDate<today)return'ended_by_date';return'current';}
function live(c){return c.lifecycleStatus==='current'&&(!c.endDate||c.endDate>=today);}
function stillRecent(c,maxDays=45){const d=c.startDate||c.publishedDate;return d&&(now-new Date(d+'T00:00:00+09:00'))/DAY<=maxDays;}
function knownReview(brandId,url){return catalog.reviews.find(r=>r.brandId===brandId&&r.officialUrl===url);}
function oldAt(brandId,url){return current.campaigns.find(c=>c.brandId===brandId&&c.officialUrl===url);}
function noReviewFood(title){return FOOD_TITLE.test(title)&&!NON_FOOD.test(title)&&!/写真投稿|投稿キャンペーン|フォロー.?リプライ|スピードくじ/.test(title)&&!/^食べ放題コースはこちら|^選べる|^【公式】|^メニュー|^お知らせ$/.test(title);}

async function processBrand(brand){
  const errors=[],roots=[],listed=new Map(),queue=new Map(),proposed=[],accepted=[],failedUrls=new Set();
  const reviews=catalog.reviews.filter(r=>r.brandId===brand.brandId);
  for(const source of brand.sources){
    try{
      const result=await fetchPage(source.url,brand);roots.push(source.url);
      if(['campaign_detail','current_menu'].includes(source.type)){
        const u=httpUrl(result.finalUrl,source.url);
        if(source.type==='current_menu')listed.set(u,true);
        queue.set(u,{url:u,title:source.campaignTitle||'',sourceUrl:source.url,type:source.type});
      }
      for(const l of discoverLinks(brand,result.html,source.url)){
        listed.set(l.url,true);
        if(!knownReview(brand.brandId,l.url)){
          if(NON_FOOD.test(l.title)||/写真投稿|投稿キャンペーン|フォロー.?リプライ|スピードくじ/.test(l.title))continue;
          if(l.title&&!FOOD_TITLE.test(l.title)&&!/詳細|詳しく|こちら|more/i.test(l.title))continue;
          const ym=new URL(l.url).pathname.match(/\/(20\d{2})\/(\d{2})\//);
          if(ym&&(now-new Date(`${ym[1]}-${ym[2]}-01T00:00:00Z`))/DAY>120)continue;
        }
        if(!queue.has(l.url))queue.set(l.url,{...l,type:source.type});
      }
    }catch(e){errors.push({url:source.url,error:e.message,kind:'index'});}
  }
  // Exact reviewed detail URLs cover image-only announcements and secondary official links.
  // An unbounded, no-longer-listed offer is not kept alive simply because its archive survives.
  for(const r of reviews){
    if(r.fields.endDate&&r.fields.endDate<today)continue;
    if(r.requiresListing&&!listed.has(r.officialUrl))continue;
    if(!queue.has(r.officialUrl))queue.set(r.officialUrl,{url:r.officialUrl,title:r.fields.title,sourceUrl:r.officialUrl,type:'reviewed_detail'});
  }
  const entries=[...queue.values()].sort((a,b)=>Number(!!knownReview(brand.brandId,b.url))-Number(!!knownReview(brand.brandId,a.url)));
  const limited=entries.slice(0,48);
  for(const link of limited){
    try{
      const {html,finalUrl}=await fetchPage(link.url,brand);
      if(!allowedDetail(brand,finalUrl))throw Error('unexpected_redirect_path');
      const p=extractPage(brand,html,finalUrl,link.title);
      const review=knownReview(brand.brandId,finalUrl);
      const d=datesFor(p,finalUrl);
      const exactReviewed=!!review&&review.contentHash===p.hash;
      const semanticReviewed=!!review&&!exactReviewed&&reviewSemanticallySupported(review,p,d);
      const reviewed=exactReviewed||semanticReviewed;
      if(!reviewed&&!noReviewFood(p.title))continue;
      if(p.bodyText.length<25)throw Error('empty_campaign_body');
      const old=oldAt(brand.brandId,finalUrl);
      let c={
        id:campaignId(brand.brandId,finalUrl),brandId:brand.brandId,brandName:brand.name,
        title:p.title,officialUrl:finalUrl,sourceUrl:link.sourceUrl,sourceType:link.type,
        campaignType:/半額|割引|OFF|お値打ち|ナイト割|クーポン/i.test(p.title)?'discount':'fair',
        priority:/半額|割引|OFF|お値打ち|ナイト割|クーポン/i.test(p.title)?'P2':'P1',
        startDate:d.startDate,endDate:d.endDate,startDateText:null,endDateText:d.endDateText,publishedDate:p.publishedDate,
        price:null,priceText:null,allYouCanEat:/食べ放題/.test(p.title),targetCourses:[],targetStores:[],targetAreas:[],regionScope:'unknown',
        limitedIngredients:[],weekdayCondition:/平日/.test(p.title)?'平日限定':null,conditions:[],
        imageUrl:selectImage(p,finalUrl,p.title),firstSeenAt:old?.firstSeenAt||stamp,fetchedAt:stamp,lastVerifiedAt:stamp,
        contentHash:p.hash,confidence:reviewed?0.98:0.76,verificationState:reviewed?'reviewed':'automatic',
        statusEvidence:semanticReviewed?'reviewed_semantic_recheck':reviewed?'reviewed_official_content':(d.startDate&&d.endDate?'official_period':'unverified'),staleAfterDays:45
      };
      const observedImage=c.imageUrl;
      if(reviewed)c={...c,...review.fields};
      if(semanticReviewed&&observedImage)c.imageUrl=observedImage;
      else if(reviewed&&c.imageUrl)c.imageUrl=httpUrl(c.imageUrl,finalUrl);
      c.lifecycleStatus=periodState(c);
      if(ENDED.test(p.title)||/販売終了いたしました|販売を終了しました|キャンペーンは終了しました/.test(p.bodyText))c.lifecycleStatus='ended_official';
      const unbounded=!c.endDate;
      const missingReview=!!review&&!reviewed;
      const eligible=reviewed||(!missingReview&&c.imageUrl&&c.startDate&&(c.endDate||stillRecent(c,30)));
      if(!eligible){c.lifecycleStatus='stale_unverified';c.statusEvidence=missingReview?'official_content_changed_review_required':'insufficient_period_evidence';}
      if(unbounded&&reviewed){
        const listedNow=listed.has(finalUrl)||listed.has(link.url);
        if(review.requiresListing&&!listedNow)c.lifecycleStatus='stale_unverified';
        if(!review.requiresListing&&!stillRecent(c,90)&&c.startDate)c.lifecycleStatus='stale_unverified';
        if(live(c))c.statusEvidence=listedNow?'official_listing_rechecked':semanticReviewed?'reviewed_semantic_recheck':'reviewed_recent_announcement';
      }
      const invalid=validateCampaign(c);if(invalid.length)throw Error(invalid.join(', '));
      proposed.push(c);
      if(c.lifecycleStatus!=='stale_unverified')accepted.push(c);
    }catch(e){errors.push({url:link.url,error:e.message,kind:'detail'});failedUrls.add(link.url);}
  }
  // Retain only records whose source actually failed; never refresh their verification timestamp.
  // Expired offers still disappear via the shared JST date logic, even during an outage.
  const previous=current.campaigns.filter(c=>c.brandId===brand.brandId);
  for(const old of previous){
    const already=accepted.some(c=>c.officialUrl===old.officialUrl);
    if(!already&&(roots.length===0||failedUrls.has(old.officialUrl))){
      const age=(now-new Date(old.lastVerifiedAt||old.fetchedAt||0))/DAY;
      if(age<=7)accepted.push({...old,verificationState:'last_known_good',lifecycleStatus:periodState(old)});
    }
  }
  const rows=dedupCampaigns(accepted),pending=proposed.filter(c=>c.lifecycleStatus==='stale_unverified');
  const hasLive=rows.some(live),sourceOk=roots.length>0;
  const degraded=errors.some(e=>e.kind==='detail'&&reviews.some(r=>r.officialUrl===e.url))||entries.length>48;
  const changedReview=pending.some(c=>c.statusEvidence==='official_content_changed_review_required'&&(!c.endDate||c.endDate>=today));
  const status=!sourceOk?'unavailable':hasLive?(degraded||changedReview?'partial':'ok'):'needs_review';
  return{rows,candidates:proposed,errors:errors.map(e=>({brandId:brand.brandId,...e})),health:{brandId:brand.brandId,status,sourceOk,
    checkedAt:stamp,lastSuccessAt:sourceOk?stamp:current.sourceHealth?.find(h=>h.brandId===brand.brandId)?.lastSuccessAt||null,
    sourceCount:brand.sources.length,readSourceCount:roots.length,discoveredCount:entries.length,checkedDetailCount:limited.length,
    liveCampaignCount:rows.filter(live).length,pendingCount:pending.length,truncated:entries.length>48,
    message:status==='unavailable'?'公式情報を取得できないため開催状況を確認できません。':status==='needs_review'?'掲載できる開催中フェアを確認できていません。':status==='partial'?'一部の情報は再確認が必要です。':'公式情報を確認しました。'}};
}
const results=[];
for(let i=0;i<SOURCES.length;i+=3)results.push(...await Promise.all(SOURCES.slice(i,i+3).map(processBrand)));
const production=dedupCampaigns(results.flatMap(r=>r.rows));
const next={...current,schemaVersion:2,updatedAt:stamp,timezone:'Asia/Tokyo',sourceHealth:results.map(r=>r.health),campaigns:production};
const gate=validateDataset(next);if(gate.length)throw Error('Quality gate: '+gate.join(', '));
if(next.sourceHealth.length!==SOURCES.length)throw Error('Incomplete source coverage');
const sourceSuccess=next.sourceHealth.filter(h=>h.sourceOk).length;
if(sourceSuccess===0)throw Error('All official sources unavailable; refusing to overwrite published data');
await fs.writeFile(OUT,JSON.stringify(next,null,2)+'\n');
await fs.writeFile(AUDIT,JSON.stringify({schemaVersion:16,updatedAt:stamp,campaigns:results.flatMap(r=>r.candidates),errors:results.flatMap(r=>r.errors),sourceHealth:next.sourceHealth},null,2)+'\n');
console.log(JSON.stringify({productionCount:production.length,sourceSuccess,sourceTotal:SOURCES.length,sourceHealth:next.sourceHealth},null,2));
