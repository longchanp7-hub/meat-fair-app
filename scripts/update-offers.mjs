import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {parseHtml,one,all,text,links} from './html-document.mjs';
import {publicUrl} from './gallery-extract.mjs';
import {SOURCES} from './source-registry.mjs';

const root=new URL('../app/data/',import.meta.url),stamp=new Date().toISOString(),MAX_AGE=172800000;
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const brands=(await read('brands.json')).brands,gallery=await read('gallery.json');
let previous={offers:[]};try{previous=await read('offers.json');}catch(e){if(e.code!=='ENOENT')throw e;}
const errors=[];
async function request(url){
  if(!publicUrl(url))throw Error('Unsafe official URL');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    let current=url,r;
    for(let n=0;n<5;n++){
      r=await fetch(current,{redirect:'manual',headers:{'User-Agent':'meat-fair-app/1.0 (+https://github.com/longchanp7-hub/meat-fair-app)'},signal:controller.signal});
      if(r.status>=300&&r.status<400){const next=publicUrl(r.headers.get('location'),current);await r.body?.cancel();if(!next)throw Error('Unsafe redirect');current=next;continue;}
      break;
    }
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const buf=Buffer.from(await r.arrayBuffer());if(buf.length>3_000_000)throw Error('Page too large');
    return{html:buf.toString('utf8'),finalUrl:current};
  }finally{clearTimeout(timer);}
}
const clean=s=>String(s||'').replace(/\s+/g,' ').replace(/^[|｜・:：\-–—\s]+|[|｜・:：\-–—\s]+$/g,'').trim();
const child=/小学生|幼児|未就学|こども|子供|お子さま|お子様|シニア|65歳|60歳|70歳/;
const addon=/追加料金|差額|プラス\s*[￥¥\d]|\+\s*[￥¥\d]|単品/;
const course=/食べ放題|食べ放題コース|ビュッフェ|バイキング|しゃぶしゃぶコース|焼肉コース|プレミアムコース/;
const drink=/飲み放題|アルコール飲み放題|ソフトドリンク飲み放題|ドリンクバー/;
const usefulLink=/食べ放題|コース|メニュー|料金|宴会|飲み放題|ドリンク|ビュッフェ|バイキング/;
function taxPrice(value){
  const s=clean(value);let m=s.match(/[（(]\s*税込\s*[:：]?\s*[￥¥]?\s*(\d[\d,]*)\s*円?\s*[）)]\s*([〜～~])?/u);
  if(!m)m=s.match(/税込\s*[:：]?\s*[￥¥]?\s*(\d[\d,]*)\s*円?\s*([〜～~])?/u);
  if(!m)return{price:null,priceText:null};const n=Number(m[1].replace(/,/g,''));
  return{price:Number.isFinite(n)?n:null,priceText:`税込${m[1]}円${m[2]?'〜':''}`};
}
function conditionsOf(s){const out=[];for(const[re,label]of[[/平日/,'平日'],[/土日祝|土・日・祝/,'土日祝'],[/ランチ/,'ランチ'],[/ディナー/,'ディナー'],[/予約限定|ネット予約|WEB予約|Web予約/,'予約条件あり'],[/店舗により|店舗によって|一部店舗/,'店舗条件あり']])if(re.test(s))out.push(label);return out;}
function titleOf(s,kind){
  let v=clean(s).replace(/[￥¥]?\d[\d,]*\s*円\s*[（(]\s*税込[^）)]*[）)]/gu,' ').replace(/[（(]\s*税込[^）)]*[）)]/gu,' ').replace(/税込\s*[￥¥]?\s*\d[\d,]*\s*円?/gu,' ');v=clean(v);
  if(v.length>110)v=v.slice(0,107)+'…';return v||(kind==='drink'?'飲み放題':'食べ放題・コース');
}
function make(raw,sourceUrl,brandId,officialUrl=sourceUrl){
  const s=clean(raw);if(s.length<4||s.length>260||child.test(s)||addon.test(s))return null;
  const kind=drink.test(s)?'drink':course.test(s)?'course':null;if(!kind)return null;
  const p=taxPrice(s);if(kind==='course'&&!p.priceText&&!/食べ放題|ビュッフェ|バイキング/.test(s))return null;
  const conditions=conditionsOf(s);return{brandId,kind,title:titleOf(s,kind),...p,conditions,officialUrl,sourceUrl,checkedAt:stamp,comparisonKey:sourceUrl+'|'+conditions.join(','),rawText:s};
}
function extract(html,sourceUrl,brandId){
  const doc=parseHtml(html),rootNode=one(doc,'main,.area-contents,.contents,body')||doc,rows=[];
  for(const node of all(rootNode,'p,li,tr,dd')){const o=make(text(node),sourceUrl,brandId);if(o)rows.push(o);}
  for(const link of links(rootNode,sourceUrl)){const o=make(link.title,sourceUrl,brandId,publicUrl(link.url)||sourceUrl);if(o)rows.push(o);}
  return rows;
}
function galleryOffers(brandId){
  const out=[];
  for(const a of gallery.assets||[]){
    if(a.brandId!==brandId||!['detail','menu'].includes(a.kind))continue;
    const o=make(a.title,a.sourceUrl||a.officialUrl,brandId,a.officialUrl);if(o&&o.priceText)out.push(o);
  }
  return out;
}
function dedupe(items){const seen=new Set();return items.filter(x=>{const k=[x.kind,x.title,x.priceText||'',x.officialUrl].join('|');if(seen.has(k))return false;seen.add(k);return true;});}
async function collect(brand){
  const profile=SOURCES.find(x=>x.brandId===brand.id),allowed=new Set([new URL(brand.homeUrl).origin]);
  for(const s of profile?.sources||[])try{allowed.add(new URL(s.url).origin)}catch{}
  const urls=[];const add=u=>{try{const x=publicUrl(u);if(x&&allowed.has(new URL(x).origin)&&!urls.includes(x))urls.push(x);}catch{}};
  for(const s of profile?.sources||[])if(['current_menu','reference_detail','brand_top'].includes(s.type))add(s.url);
  let homeOk=false;
  try{
    const {html,finalUrl}=await request(brand.homeUrl);if(!allowed.has(new URL(finalUrl).origin))throw Error('Unexpected official redirect');homeOk=true;add(finalUrl);
    const doc=parseHtml(html),rootNode=one(doc,'main,.area-contents,.contents,body')||doc;
    for(const l of links(rootNode,finalUrl))if(usefulLink.test((l.title||'')+' '+l.url))add(l.url);
  }catch(e){errors.push({brandId:brand.id,url:brand.homeUrl,error:e.message});}
  const found=[...galleryOffers(brand.id)];let pagesRead=0;
  const pages=await Promise.all(urls.slice(0,5).map(async url=>{
    try{const {html,finalUrl}=await request(url);if(!allowed.has(new URL(finalUrl).origin))throw Error('Unexpected official redirect');return{ok:true,url,rows:extract(html,finalUrl,brand.id)};}
    catch(e){return{ok:false,url,error:e.message,rows:[]};}
  }));
  for(const p of pages){if(p.ok){pagesRead++;found.push(...p.rows);}else errors.push({brandId:brand.id,url:p.url,error:p.error});}
  let offers=dedupe(found).slice(0,24).map((x,i)=>({...x,rank:i,id:crypto.createHash('sha256').update([brand.id,x.kind,x.title,x.priceText||'',x.officialUrl].join('|')).digest('hex').slice(0,16)}));
  if(!offers.length&&(!homeOk||pages.some(p=>!p.ok))){
    const old=(previous.offers||[]).filter(x=>x.brandId===brand.id&&Date.now()-Date.parse(x.checkedAt)<MAX_AGE);offers=old;
    return{offers,health:{brandId:brand.id,status:old.length?'last_known_good':'partial',pagesRead,offers:old.length}};
  }
  return{offers,health:{brandId:brand.id,status:errors.some(e=>e.brandId===brand.id)?'partial':'ok',pagesRead,offers:offers.length}};
}
const results=[];for(let i=0;i<brands.length;i+=3)results.push(...await Promise.all(brands.slice(i,i+3).map(collect)));
const result={schemaVersion:1,updatedAt:stamp,galleryUpdatedAt:gallery.updatedAt,offers:results.flatMap(x=>x.offers),sourceHealth:results.map(x=>x.health),errors};
await fs.writeFile(new URL('offers.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({offers:result.offers.length,brands:result.sourceHealth,warnings:errors.length},null,2));
