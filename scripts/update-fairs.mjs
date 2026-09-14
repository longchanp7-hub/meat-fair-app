import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { SOURCES } from './source-registry.mjs';
import { validateDataset, validateCampaign } from './quality-gate.mjs';
import { linksFromHtml,rawDetailUrls,relevantTitle,allowedPath,campaignId,textFromHtml,titleFromHtml,dateFields,imageCandidatesFromHtml,deriveFields,canonicalUrl,firstDate,lifecycleFields,targetCoursesFromText } from './fair-utils.mjs';

const OUT=new URL('../app/data/fairs.json',import.meta.url);
const CANDIDATE=new URL('../app/data/candidates.json',import.meta.url);
const NON_FOOD=/(?:アンケート|Q\d|学生|食育|啓発|採用|求人|抽選会|大抽選|スピードくじ|ポイント山分け|プレゼント|アプリ会員.{0,12}(?:突破|記念)|SNS|フォロー|リポスト|グッズ|キャンペーン開催記念)/i;
const FOOD_SIGNAL=/(?:フェア|期間限定|季節|食べ放題|半額|割引|特別価格|コース|メニュー|牛タン|牛たん|カルビ|焼肉|しゃぶ|鴨|きのこ|松茸|寿司|サーモン|秋刀魚|蟹|かに|肉|デザート)/i;
async function fetchText(url){const r=await fetch(url,{headers:{'user-agent':'meat-fair-app/0.2 (+github-actions)'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}
const auxCache=new Map();
async function fetchCached(url){if(!auxCache.has(url))auxCache.set(url,fetchText(url));return await auxCache.get(url)}
function kingHomeVisualScore(title,url){const u=url.toLowerCase();let bonus=0;if(title.includes('ハワイ')){if(/king2101_hawaii/.test(u))bonus+=55;else if(/hawaii|hawaiian/.test(u))bonus+=36;if(/kingshawaiian/.test(u))bonus-=24;if(/1500x1500|1500_1500/.test(u))bonus+=5}if(title.includes('韓国')){if(/korea|korean|kankoku|kannkoku|shijang|shijan/.test(u))bonus+=34;if(/chusenkai|speedkuji|yamawake|抽選|kuji/.test(u))bonus-=40}return bonus}
function nearbyImageText(html,url){try{const name=decodeURIComponent(new URL(url).pathname.split('/').pop()||'');if(!name)return'';let i=html.indexOf(name);if(i<0)i=html.toLowerCase().indexOf(name.toLowerCase());if(i<0)return'';return textFromHtml(html.slice(Math.max(0,i-650),Math.min(html.length,i+1100)))}catch{return''}}
function brandVisualBoost(brandId,title,url,ctx=''){const u=url.toLowerCase();let bonus=0;
  if(brandId==='gyukaku'&&/牛タン|牛たん/.test(title)){
    if(/牛タン|牛たん|タン塩|ねぎ牛タン|上タン/.test(ctx))bonus+=42;
    if(/ビール|ハイボール|サワー|アルコール|ドリンク|飲み放題|ジョッキ/.test(ctx))bonus-=70;
    if(/beer|drink|alcohol|sour|highball/.test(u))bonus-=70;
    if(/\/ogp\.png(?:\?|$)/.test(u))bonus+=10;
  }
  if(brandId==='syabuyo'){
    if(/秋のきのこと鴨しゃぶフェア|鴨肉と6種のきのこ|秋の味覚/.test(ctx))bonus+=26;
    if(/おすすめのお肉|柔らかくジューシーな鴨肉|鴨ロース肉/.test(ctx))bonus-=18;
    if(/(?:^|[_-])pc[_-]?0?1(?:[._-]|$)/i.test(u))bonus+=34;
    if(/(?:^|[_-])pc[_-]?0?2(?:[._-]|$)/i.test(u))bonus-=12;
  }
  if(brandId==='yuzuan'){
    if(/seasonal-abstract-title|\/seasonal\/r(?:$|\?)/.test(u))bonus-=100;
    if(/旬のごちそう|秋期間限定|期間限定メニュー/.test(ctx))bonus+=20;
    if(/main|hero|visual|kv|mv|fv/.test(u))bonus+=18;
    if(/web_(?:sushi|nabe)_1500x1000_2609/.test(u))bonus+=32;
    if(/syabu\d+_2609|sushi\d+_2609/.test(u))bonus-=8;
    if(/握り|手巻き|茶碗蒸し|単品|三貫盛り/.test(ctx))bonus-=12;
  }
  return bonus}
function decorateCandidates(brandId,title,html,list,source,baseBonus=0){return list.map(c=>{const ctx=nearbyImageText(html,c.url);return{...c,score:c.score+baseBonus+brandVisualBoost(brandId,title,c.url,ctx),source}})}
async function selectFoodImage(brandId,html,officialUrl,title){const candidates=decorateCandidates(brandId,title,html,imageCandidatesFromHtml(html,officialUrl,{title}),'detail');const links=linksFromHtml(html,officialUrl);const extras=[];if(brandId==='yuzuan'){for(const x of links.filter(x=>new URL(x.url).pathname==='/seasonal/'||new URL(x.url).pathname.startsWith('/seasonal/')).slice(0,2))extras.push(x.url)}else if(brandId==='yakiniku-king'&&!new URL(officialUrl).pathname.startsWith('/menu_all/season/')){const x=links.find(x=>/\/menu_all\/season\/[A-Za-z0-9_-]+\/?$/.test(new URL(x.url).pathname));if(x)extras.push(x.url)}for(const url of [...new Set(extras)]){try{const linkedHtml=await fetchCached(url);candidates.push(...decorateCandidates(brandId,title,linkedHtml,imageCandidatesFromHtml(linkedHtml,url,{title}),'campaign-page',5))}catch{}}
  if(brandId==='yakiniku-king'&&/(ハワイ|韓国)/.test(title)){
    try{const homeUrl='https://www.yakiniku-king.jp/';const homeHtml=await fetchCached(homeUrl);for(const c of imageCandidatesFromHtml(homeHtml,homeUrl,{title})){const bonus=kingHomeVisualScore(title,c.url);if(bonus>0)candidates.push({...c,score:c.score+bonus,source:'brand-home-campaign'})}}catch{}
  }
  const bestByUrl=new Map();for(const c of candidates){const old=bestByUrl.get(c.url);if(!old||c.score>old.score)bestByUrl.set(c.url,c)}const best=[...bestByUrl.values()].sort((a,b)=>b.score-a.score)[0];return best&&best.score>=5?best.url:null}
function titleKey(s=''){return s.replace(/20\d{2}年\d{1,2}月\d{1,2}日[^「『]*/g,'').replace(/焼肉きんぐ|牛角|しゃぶ葉|ゆず庵/g,'').replace(/お知らせ|期間限定|販売開始|発売開始|開催します|開催|フェア|キャンペーン/g,'').replace(/[\s　!！?？。、・「」『』（）()\-~〜～|｜]/g,'').trim()}
function foodRelevant(c){if(NON_FOOD.test(c.title))return false;if(!['P1','P2'].includes(c.priority))return false;return FOOD_SIGNAL.test(`${c.title} ${(c.limitedIngredients||[]).join(' ')} ${(c.targetCourses||[]).join(' ')}`)}
function richer(a,b){const score=c=>(c.sourceType==='seasonal_index'?6:0)+(c.endDate?3:0)+(c.startDate?2:0)+(c.imageUrl?2:0)+(c.targetCourses?.length||0)+(c.limitedIngredients?.length||0)/10+(c.priority==='P1'?2:0);return score(a)>=score(b)?a:b}
function similarCampaign(a,b){if(a.brandId!==b.brandId)return false;const ak=titleKey(a.title),bk=titleKey(b.title);if(ak.length>=4&&bk.length>=4&&(ak.includes(bk)||bk.includes(ak)))return true;if(a.startDate&&b.startDate&&a.startDate===b.startDate){const ai=new Set(a.limitedIngredients||[]),bi=new Set(b.limitedIngredients||[]);if([...ai].some(x=>bi.has(x)))return true}return false}
function semanticDedup(list){const out=[];for(const c of list.filter(foodRelevant)){const hit=out.findIndex(x=>similarCampaign(x,c));if(hit<0){out.push({...c,secondarySources:c.secondarySources||[]});continue}const old=out[hit],keep=richer(old,c),other=keep===old?c:old;const secondary=[...(keep.secondarySources||[]),{url:other.officialUrl,type:other.sourceType,title:other.title},...(other.secondarySources||[])];out[hit]={...keep,secondarySources:[...new Map(secondary.map(s=>[s.url,s])).values()]}}return out}

const nowIso=new Date().toISOString();const now=new Date();let current={schemaVersion:1,updatedAt:null,timezone:'Asia/Tokyo',statusRules:{newDays:7,endingSoonDays:7},campaigns:[]};try{current=JSON.parse(await fs.readFile(OUT,'utf8'))}catch{}const previous=new Map((current.campaigns||[]).map(c=>[`${c.brandId}|${canonicalUrl(c.officialUrl)}`,c]));const candidates=[];const errors=[];const sourceOk=new Set();
for(const brand of SOURCES.slice(0,4)){for(const source of brand.sources){try{const indexHtml=await fetchText(source.url);sourceOk.add(brand.brandId);const map=new Map();const discovered=[...linksFromHtml(indexHtml,source.url),...rawDetailUrls(brand.brandId,indexHtml,source.url)];for(const l of discovered){if(allowedPath(brand.brandId,l.url)&&!map.has(l.url))map.set(l.url,l)}for(const link of [...map.values()].slice(0,24)){try{const html=await fetchText(link.url);const text=textFromHtml(html);const detailTitle=titleFromHtml(html)||link.title;if(!relevantTitle(detailTitle)||NON_FOOD.test(detailTitle))continue;const d=dateFields(text);const x=deriveFields(detailTitle,text);const publishedDate=firstDate(text);const life=lifecycleFields({text,startDate:d.startDate,endDate:d.endDate,publishedDate,campaignType:x.campaignType,now});const officialUrl=canonicalUrl(link.url);const old=previous.get(`${brand.brandId}|${officialUrl}`);const imageUrl=await selectFoodImage(brand.brandId,html,officialUrl,detailTitle);const c={id:campaignId(brand.brandId,officialUrl),brandId:brand.brandId,brandName:brand.name,title:detailTitle,officialUrl,sourceUrl:source.url,sourceType:source.type,campaignType:x.campaignType,priority:x.priority,startDate:d.startDate,startDateText:null,endDate:d.endDate,endDateText:d.endDateText,publishedDate,price:x.price,priceText:x.priceText,allYouCanEat:x.allYouCanEat,targetCourses:targetCoursesFromText(brand.brandId,text),targetStores:[],targetAreas:[],regionScope:x.regionScope,limitedIngredients:x.limitedIngredients,weekdayCondition:x.weekdayCondition,conditions:[],imageUrl,lifecycleStatus:life.lifecycleStatus,staleAfterDays:life.staleAfterDays,firstSeenAt:old?.firstSeenAt||nowIso,fetchedAt:nowIso,lastVerifiedAt:nowIso,confidence:(d.startDate||d.endDate||/期間限定|フェア|コラボ|半額|割引/.test(detailTitle))?0.9:0.72,contentHash:crypto.createHash('sha256').update(text.slice(0,20000)).digest('hex')};if(!validateCampaign(c).length)candidates.push(c)}catch(e){errors.push({brandId:brand.brandId,url:link.url,error:String(e.message||e)})}}}catch(e){errors.push({brandId:brand.brandId,url:source.url,error:String(e.message||e)})}}}
const urlDedup=[...new Map(candidates.map(c=>[`${c.brandId}|${c.officialUrl}`,c])).values()];const dedup=semanticDedup(urlDedup);await fs.writeFile(CANDIDATE,JSON.stringify({schemaVersion:11,updatedAt:nowIso,campaigns:dedup,errors},null,2));let production=[...(current.campaigns||[])];for(const brand of SOURCES.slice(0,4)){const fresh=dedup.filter(c=>c.brandId===brand.brandId&&c.confidence>=0.72);if(sourceOk.has(brand.brandId))production=production.filter(c=>c.brandId!==brand.brandId).concat(fresh);else errors.push({brandId:brand.brandId,error:'source_failed_using_lkg'})}const next={...current,updatedAt:nowIso,campaigns:production};const gate=validateDataset(next);if(gate.length)throw new Error(`quality gate failed: ${gate.join(', ')}`);await fs.writeFile(OUT,JSON.stringify(next,null,2));console.log(JSON.stringify({candidateCount:dedup.length,errorCount:errors.length,productionCount:next.campaigns.length,sourceOk:[...sourceOk]},null,2));
