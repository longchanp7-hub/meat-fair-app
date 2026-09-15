import fs from 'node:fs/promises';
import path from 'node:path';
import {extractCatalogPage,discoverCatalogLinks,dedupCatalog,contentHash} from './catalog-extract.mjs';
import {publicUrl,dimensions} from './gallery-extract.mjs';
import {markup} from './html-document.mjs';
import {CATALOG_SOURCES} from './catalog-sources.mjs';
import {SOURCES} from './source-registry.mjs';
import {extractPage} from './site-profiles.mjs';
import {campaignStatus} from '../app/status.mjs';

const root=new URL('../app/data/',import.meta.url),stamp=new Date().toISOString(),now=Date.parse(stamp),TTL=172800000;
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const brands=(await read('brands.json')).brands,fairs=await read('fairs.json'),gallery=await read('gallery.json');
let previous={entries:[]};try{previous=await read('catalog.json');}catch(e){if(e.code!=='ENOENT')throw e;}
const capture=process.env.CATALOG_CAPTURE_DIR;
if(capture)await fs.mkdir(capture,{recursive:true});
const requests=new Map(),imageRequests=new Map();
async function request(url,{image=false}={}){
  if(!publicUrl(url))throw Error('Unsafe source URL');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    let current=url,response;
    for(let i=0;i<5;i++){
      response=await fetch(current,{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'meat-fair-app/1.1 (+https://github.com/longchanp7-hub/meat-fair-app)'}});
      if(response.status>=300&&response.status<400){
        const next=publicUrl(response.headers.get('location'),current);await response.body?.cancel();
        if(!next||(!image&&new URL(next).origin!==new URL(url).origin))throw Error('Unexpected redirect');
        current=next;continue;
      }
      break;
    }
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const limit=image?8000000:2500000,reader=response.body.getReader(),chunks=[];let count=0,complete=false;
    try{while(count<limit){const {done,value}=await reader.read();if(done){complete=true;break;}const b=value.subarray(0,limit-count);chunks.push(b);count+=b.length;if(image&&dimensions(Buffer.concat(chunks)))break;}}finally{await reader.cancel();}
    const bytes=Buffer.concat(chunks);
    if(image){const d=dimensions(bytes);if(!d)throw Error('Unsupported image signature');return d;}
    if(!complete&&count>=limit)throw Error('Oversized source page');
    const type=response.headers.get('content-type')||'';
    if(!/html|text\//i.test(type))throw Error('Not an HTML page');
    const charset=/charset\s*=\s*([^;\s]+)/i.exec(type)?.[1]||'utf-8';
    let html;try{html=new TextDecoder(charset).decode(bytes);}catch{html=bytes.toString('utf8');}
    return{html,url:current};
  }finally{clearTimeout(timer);}
}
function page(url){if(!requests.has(url))requests.set(url,request(url));return requests.get(url);}
function probe(url){if(!imageRequests.has(url))imageRequests.set(url,request(url,{image:true}));return imageRequests.get(url);}
function usableParent(entry){return !entry.campaignId||fairs.campaigns.some(c=>c.id===entry.campaignId&&c.brandId===entry.brandId&&c.contentHash===entry.parentHash&&campaignStatus(c,new Date(now)).state!=='ended');}
async function collectBrand(brand){
  const queue=[{url:brand.homeUrl,depth:0,rank:-1}],visited=new Set(),entries=[],sources=[],errors=[];
  const profile=SOURCES.find(s=>s.brandId===brand.id);
  // Existing registry URLs are already observed official sources, not guesses.
  for(const url of CATALOG_SOURCES[brand.id]||[])queue.push({url,depth:0,rank:-.5});
  for(const s of profile.sources)if(/price|menu|course/.test(s.url)&&new URL(s.url).origin===new URL(brand.homeUrl).origin)queue.push({url:s.url,depth:0,rank:0});
  const live=fairs.campaigns.filter(c=>c.brandId===brand.id&&['P1','P2'].includes(c.priority)&&campaignStatus(c,new Date(now)).state!=='ended');
  for(const c of live)queue.push({url:c.officialUrl,campaign:c,depth:2,rank:3});
  let count=0;
  while(queue.length&&count<18){
    queue.sort((a,b)=>a.rank-b.rank||a.depth-b.depth);
    const item=queue.shift(),url=publicUrl(item.url);if(!url||visited.has(url))continue;visited.add(url);count++;
    try{
      const received=await page(url);
      if(capture)await fs.writeFile(path.join(capture,brand.id+'-'+contentHash(url).slice(0,12)+'.html'),received.html);
      if(item.campaign){
        const current=extractPage(profile,received.html,url,item.campaign.title);
        if(current.hash!==item.campaign.contentHash)throw Error('campaign_content_changed_pending_review');
      }
      const scopedHtml=item.campaign?markup(extractPage(profile,received.html,url,item.campaign.title).scope):received.html;
      const extracted=extractCatalogPage(scopedHtml,received.url,brand,{checkedAt:stamp,campaign:item.campaign||null});
      // The fair key visual belongs in the fair gallery, never a duplicate menu.
      const mainImages=new Set(live.map(c=>c.imageUrl).filter(Boolean));
      entries.push(...extracted.items.filter(e=>!mainImages.has(e.imageUrl)));
      sources.push({...extracted.source,brandId:brand.id,requestedUrl:url});
      if(item.depth<2||item.campaign)for(const l of discoverCatalogLinks(received.html,received.url,brand))if(!visited.has(l.url))queue.push({...l,depth:item.campaign?1:item.depth+1,rank:l.rank+item.depth*.5});
    }catch(e){
      errors.push({brandId:brand.id,url,error:e.message});
      sources.push({brandId:brand.id,sourceUrl:url,checkedAt:null,status:'unavailable',error:e.message});
      // A failure does not mean a course ended, but cannot extend its TTL.
      entries.push(...previous.entries.filter(e=>e.brandId===brand.id&&e.sourceUrl===url&&now-Date.parse(e.checkedAt)>=0&&now-Date.parse(e.checkedAt)<=TTL&&usableParent(e)).map(e=>({...e,verificationState:'last_known_good'})));
    }
  }
  const result=[];
  for(const e of dedupCatalog(entries)){
    if(!usableParent(e))continue;
    if(e.imageUrl){
      try{
        const d=await probe(e.imageUrl);
        // Tiny navigation artwork is not a content photo. Keep useful official
        // text, but do not enlarge its black/blank lower navigation panel.
        if(d.width<320||d.height<100||d.width/d.height>8||d.height/d.width>6)e.imageUrl=null;
        else Object.assign(e,d);
      }catch(err){errors.push({brandId:brand.id,url:e.imageUrl,error:err.message});e.imageUrl=null;}
    }
    result.push(e);
  }
  const total=kind=>result.filter(e=>e.kind===kind).length;
  return{entries:result,sources,errors,health:{brandId:brand.id,status:errors.length?'partial':'ok',pagesRead:sources.filter(s=>s.status==='ok').length,courses:total('course'),highlights:total('highlight'),drinks:total('drink')}};
}
const results=[];
for(let i=0;i<brands.length;i+=3)results.push(...await Promise.all(brands.slice(i,i+3).map(collectBrand)));
const catalog={schemaVersion:1,policyVersion:2,updatedAt:stamp,fairsUpdatedAt:fairs.updatedAt,galleryUpdatedAt:gallery.updatedAt,ttlHours:48,entries:results.flatMap(r=>r.entries),sources:results.flatMap(r=>r.sources),sourceHealth:results.map(r=>r.health),errors:results.flatMap(r=>r.errors)};
await fs.writeFile(new URL('catalog.json',root),JSON.stringify(catalog,null,2)+'\n');
if(capture)await fs.writeFile(path.join(capture,'index.json'),JSON.stringify(catalog,null,2));
console.log(JSON.stringify({catalogEntries:catalog.entries.length,sourceHealth:catalog.sourceHealth,warnings:catalog.errors.length},null,2));
