import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {extractPage} from './site-profiles.mjs';
import {SOURCES} from './source-registry.mjs';
import {campaignStatus} from '../app/status.mjs';
import {publicUrl,detailAssets,menuAssets,dimensions,imageKey} from './gallery-extract.mjs';
const root=new URL('../app/data/',import.meta.url),stamp=new Date().toISOString();
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const fairs=await read('fairs.json'),brands=(await read('brands.json')).brands;
let previous={assets:[]};try{previous=await read('gallery.json');}catch(e){if(e.code!=='ENOENT')throw e;}
const cache=new Map(),probes=new Map(),errors=[];
async function request(url,limit,headerOnly=false){
  if(!publicUrl(url))throw Error('Unsafe asset/source URL');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
    let current=url,r;
    for(let n=0;n<5;n++){
      r=await fetch(current,{redirect:'manual',headers:{'User-Agent':'meat-fair-app/1.0 (+https://github.com/longchanp7-hub/meat-fair-app)'},signal:controller.signal});
      if(r.status>=300&&r.status<400){const next=publicUrl(r.headers.get('location'),current);await r.body?.cancel();if(!next)throw Error('Unsafe redirect');current=next;continue;}
      break;
    }
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const reader=r.body.getReader(),chunks=[];let size=0;
    try{while(size<limit){const {done,value}=await reader.read();if(done)break;const take=value.subarray(0,limit-size);chunks.push(take);size+=take.length;if(headerOnly&&dimensions(Buffer.concat(chunks)))break;}}finally{await reader.cancel();}
    return{bytes:Buffer.concat(chunks),finalUrl:current};
  }finally{clearTimeout(timeout);}
}
async function page(url){
  if(!cache.has(url))cache.set(url,request(url,2_000_000).then(r=>{
    if(new URL(r.finalUrl).origin!==new URL(url).origin)throw Error('Unexpected page redirect');
    return r.bytes.toString('utf8');
  }));return cache.get(url);
}
async function probe(url){
  // Stop as soon as dimensions are known. A bounded larger budget handles JPEGs
  // with large ICC profiles without downloading every complete image.
  if(!probes.has(url))probes.set(url,request(url,8_000_000,true).then(({bytes})=>{
    const d=dimensions(bytes);if(!d)throw Error('Unsupported image signature: '+bytes.subarray(0,16).toString('hex'));if(d.width<100||d.height<65||d.width/d.height>8||d.height/d.width>5)throw Error('Non-card image or unsupported dimensions');return d;
  }));return probes.get(url);
}
async function enrich(brand){
  const campaigns=fairs.campaigns.filter(c=>c.brandId===brand.id&&['P1','P2'].includes(c.priority)&&campaignStatus(c).state!=='ended');
  const profile=SOURCES.find(b=>b.brandId===brand.id),raw=[];
  let pagesRead=0;
  for(const [order,c] of campaigns.entries()){
    if(c.imageUrl)raw.push({kind:'campaign',rank:order?10:0,imageUrl:c.imageUrl,title:c.title,officialUrl:c.officialUrl,sourceUrl:c.officialUrl,campaignId:c.id,parentHash:c.contentHash,checkedAt:c.lastVerifiedAt||stamp});
    try{
      const p=extractPage(profile,await page(c.officialUrl),c.officialUrl,c.title);pagesRead++;
      if(p.hash!==c.contentHash){errors.push({brandId:brand.id,url:c.officialUrl,error:'content_changed_pending_campaign_review'});continue;}
      raw.push(...detailAssets(p.scope,c.officialUrl,c).map(a=>({...a,checkedAt:stamp})));
    }catch(e){
      errors.push({brandId:brand.id,url:c.officialUrl,error:e.message});
      raw.push(...previous.assets.filter(a=>a.brandId===brand.id&&a.campaignId===c.id&&a.parentHash===c.contentHash&&a.kind==='detail'&&Date.now()-Date.parse(a.checkedAt)<172800000));
    }
  }
  try{raw.push(...menuAssets(await page(brand.homeUrl),brand.homeUrl,campaigns.map(c=>c.officialUrl)).map(a=>({...a,checkedAt:stamp})));pagesRead++;}
  catch(e){errors.push({brandId:brand.id,url:brand.homeUrl,error:e.message});raw.push(...previous.assets.filter(a=>a.brandId===brand.id&&a.kind==='menu'&&Date.now()-Date.parse(a.checkedAt)<172800000));}
  const seen=new Set(),assets=[];
  for(const a of raw.sort((a,b)=>a.rank-b.rank)){
    if(!publicUrl(a.imageUrl)||!publicUrl(a.officialUrl))continue;
    const key=imageKey(a.imageUrl);if(seen.has(key))continue;seen.add(key);
    try{const d=await probe(a.imageUrl);if(a.kind==='detail'&&d.width/d.height>4)continue;assets.push({...a,...d,brandId:brand.id,id:crypto.createHash('sha256').update(brand.id+'|'+a.imageUrl).digest('hex').slice(0,16)});}
    catch(e){
      errors.push({brandId:brand.id,url:a.imageUrl,error:e.message});
      const old=previous.assets.find(x=>x.brandId===brand.id&&x.imageUrl===a.imageUrl&&x.parentHash===a.parentHash&&Date.now()-Date.parse(x.checkedAt)<172800000);
      if(old)assets.push(old);
    }
  }
  return{assets,health:{brandId:brand.id,pagesRead,images:assets.length,status:errors.some(e=>e.brandId===brand.id)?'partial':'ok'}};
}
const results=[];
for(let i=0;i<brands.length;i+=3)results.push(...await Promise.all(brands.slice(i,i+3).map(enrich)));
const result={schemaVersion:1,updatedAt:stamp,fairsUpdatedAt:fairs.updatedAt,assets:results.flatMap(r=>r.assets),sourceHealth:results.map(r=>r.health),errors};
await fs.writeFile(new URL('gallery.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({galleryAssets:result.assets.length,brands:result.sourceHealth,warnings:errors.length},null,2));
