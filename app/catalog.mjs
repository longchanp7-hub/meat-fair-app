import {reviewedCatalogFallbacks} from './catalog-reviewed-bridge.mjs?v=20260915-sakai2';
import {campaignStatus} from './status.mjs';
import {selectMedia} from './gallery.mjs?v=20260915-sakai1';
import {presentationFor,catalogEntryVisible} from './presentation.mjs?v=20260915-cleanup1';
const TTL=48*60*60*1000;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const knownPrice=e=>Number.isFinite(e.price?.amount)&&e.price?.taxIncluded===true;
const priceOf=e=>knownPrice(e)?e.price.amount:Infinity;
const norm=v=>String(v||'').normalize('NFKC').replace(/\s+/g,' ').trim();

export function catalogEntryCurrent(e,fairs,now=new Date(),generationMatches=true){
  const age=+now-Date.parse(e.checkedAt);
  if(!Number.isFinite(age)||age<0||age>TTL||!safe(e.sourceUrl)||!safe(e.officialUrl))return false;
  if(!e.campaignId)return true;
  return generationMatches&&(fairs.campaigns||[]).some(c=>c.id===e.campaignId&&c.brandId===e.brandId&&c.contentHash===e.parentHash&&campaignStatus(c,now).state==='active');
}
export function selectCatalog(data,brandId,fairs,now=new Date()){
  if(data?.schemaVersion!==1||!Array.isArray(data.entries))return [];
  const generationMatches=data.fairsUpdatedAt===fairs.updatedAt,used=new Set();
  return data.entries.filter(e=>e.brandId===brandId&&catalogEntryVisible(brandId,e)&&catalogEntryCurrent(e,fairs,now,generationMatches)).filter(e=>{if(used.has(e.id))return false;used.add(e.id);return true;}).map(e=>({...e,verificationState:!generationMatches?'last_known_good':e.verificationState}));
}
export function groupCoursePrices(entries){
  const groups=new Map();
  for(const e of entries){
    const context=e.context||{},ambiguous=['service','days','audience'].some(k=>!context[k]||context[k]==='未確認');
    const key=(e.comparisonKey||e.sourceUrl)+(ambiguous&&!e.comparisonEvidence?'|'+e.id:'');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
  }
  return [...groups.values()].map(group=>group.sort((a,b)=>priceOf(a)-priceOf(b)||(a.rank??100)-(b.rank??100)||a.title.localeCompare(b.title,'ja')));
}
function shortConditions(e){
  const c=e.context||{},parts=[c.subBrand,c.service,c.days,c.audience,c.channel==='通常掲載'?null:c.channel,c.charge==='追加料金'?'追加料金':null].filter(x=>x&&x!=='未確認'&&!/^公式/.test(x));
  const evidence=(e.evidenceText||'').split('公式HTML画像 ')[0];
  const duration=evidence.match(/(?:制限時間|食べ放題|飲み放題)?\s*(\d{2,3})\s*分(?:制|間)?/u);if(duration)parts.push(duration[0].trim());
  return [...new Set(parts)].slice(0,4);
}
function labelFor(e){
  if(e.context?.subBrand)return e.context.subBrand;
  if(e.kind==='drink')return /ソフト|ドリンクバー|さとカフェ/.test(e.title)?'ソフトドリンク':/アルコール|生ビール|酒|さとバル/.test(e.title)?'アルコール':'飲み放題';
  return /ランチ/.test(e.title)?'ランチ':'コース';
}
function priceText(e){
  if(knownPrice(e))return e.price.text;
  if(e.price?.rawText)return e.price.rawText;
  if(e.freeText)return e.freeText;
  return '料金は公式で要確認';
}
function textTile(e){
  const conditions=shortConditions(e),known=knownPrice(e);
  return `<a class="catalog-card compact-card" data-catalog-id="${esc(e.id)}" data-catalog-kind="${esc(e.kind)}" data-price="${known?e.price.amount:''}" data-context="${esc(e.comparisonKey||e.sourceUrl)}" href="${esc(safe(e.officialUrl))}" target="_blank" rel="noopener noreferrer"><span class="catalog-label">${esc(labelFor(e))}</span><span class="compact-main"><b>${esc(e.title)}</b><strong class="catalog-price${known?'':' unconfirmed'}">${esc(priceText(e))}</strong></span>${conditions.length?`<small class="catalog-terms">${esc(conditions.join(' · '))}</small>`:''}${e.verificationState==='last_known_good'?'<small class="catalog-stale">前回の確認情報</small>':''}</a>`;
}
function photoTile(e,kind){
  const known=knownPrice(e),w=Number(e.width)||0,h=Number(e.height)||0;
  return `<a class="catalog-photo-card" data-catalog-photo="${esc(kind)}" data-catalog-id="${esc(e.id)}" data-price="${known?e.price.amount:''}" href="${esc(safe(e.officialUrl))}" target="_blank" rel="noopener noreferrer"><span class="catalog-photo-frame"><img src="${esc(safe(e.imageUrl))}" alt="${esc(e.title)}" ${w&&h?`width="${w}" height="${h}"`:''} loading="lazy" decoding="async" referrerpolicy="no-referrer"></span><span class="catalog-photo-caption"><small>${esc(labelFor(e))}</small><b>${esc(e.title)}</b><strong class="catalog-price${known?'':' unconfirmed'}">${esc(priceText(e))}</strong></span></a>`;
}
function sakaiOrder(title){
  if(/お手軽/.test(title))return 1;
  if(/ライト/.test(title))return 2;
  if(/スペシャル/.test(title))return 3;
  if(/贅沢|プレミアム/.test(title))return 4;
  return 99;
}
function sortedGroups(rows,brandId){
  const groups=groupCoursePrices(rows);
  const min=g=>Math.min(...g.map(priceOf));
  return groups.sort((a,b)=>{
    if(brandId==='yakiniku-king'){
      const al=a.some(e=>/ランチ/.test(e.title)),bl=b.some(e=>/ランチ/.test(e.title));
      if(al!==bl)return al?1:-1;
    }
    return min(a)-min(b)||(a[0]?.rank??100)-(b[0]?.rank??100);
  });
}
function sectionRows(entries,kind,brandId){
  const rows=entries.filter(e=>e.kind===kind);
  if(kind==='course'&&brandId==='nikusho-sakai')return [...rows].sort((a,b)=>sakaiOrder(a.title)-sakaiOrder(b.title)||(a.rank??100)-(b.rank??100));
  return kind==='course'?sortedGroups(rows,brandId).flat():rows.sort((a,b)=>priceOf(a)-priceOf(b)||(a.rank??100)-(b.rank??100));
}
function semanticKey(e){
  const c=e.context||{};
  return [e.kind,norm(e.title),knownPrice(e)?e.price.amount:priceText(e),norm(c.service),norm(c.days),norm(c.audience)].join('|');
}
function semanticScore(e){
  return (knownPrice(e)?8:0)+(e.imageUrl?4:0)+(e.verificationState==='confirmed'?3:e.verificationState==='last_known_good'?1:0)+(e.sourceMethod?.includes('review')?1:0);
}
function dedupeSemantic(entries){
  const map=new Map();
  for(const e of entries){
    const key=semanticKey(e),old=map.get(key);
    if(!old||semanticScore(e)>semanticScore(old))map.set(key,e);
  }
  return [...map.values()];
}
function reviewedSatoVersionRows(entries){
  const marker=entries.find(e=>e.brandId==='washoku-sato'&&e.kind==='course'&&/ayce-260616\.jpg/.test(String(e.imageUrl||''))&&e.verificationState==='confirmed');
  if(!marker)return [];
  const base={...marker,imageUrl:null,width:null,height:null,rank:-10,verificationState:'confirmed',sourceMethod:'reviewed-current-menu-version'};
  return [
    {...base,id:'sato-shabu-ayce-260616',title:'さとしゃぶ 食べ放題（大人）',officialUrl:'https://sato-res.com/satoshabu/',sourceUrl:marker.sourceUrl,price:{amount:2189,text:'税込2,189円〜6,039円',taxIncluded:true,from:true},context:{...marker.context,service:'ディナー',audience:'大人',scope:'sato-shabu-current'},comparisonKey:'sato-shabu|ayce-260616',comparisonEvidence:'official-current-menu-version-ayce-260616',evidenceText:'公式食べ放題メニュー ayce-260616 の確認済み料金帯'},
    {...base,id:'sato-suki-ayce-260616',title:'さとすき 食べ放題（大人）',officialUrl:'https://sato-res.com/satosuki/',sourceUrl:marker.sourceUrl,price:{amount:2189,text:'税込2,189円〜6,039円',taxIncluded:true,from:true},context:{...marker.context,service:'ディナー',audience:'大人',scope:'sato-suki-current'},comparisonKey:'sato-suki|ayce-260616',comparisonEvidence:'official-current-menu-version-ayce-260616',evidenceText:'公式食べ放題メニュー ayce-260616 の確認済み料金帯'}
  ];
}
function roanRange(entries,pattern,title,service,id){
  const rows=entries.filter(e=>e.kind==='course'&&pattern.test(String(e.title||''))&&knownPrice(e));
  if(!rows.length)return null;
  const amounts=[...new Set(rows.map(e=>e.price.amount))].sort((a,b)=>a-b),base=rows.sort((a,b)=>priceOf(a)-priceOf(b))[0];
  const text=amounts.length>1?`税込${amounts[0].toLocaleString('ja-JP')}〜${amounts.at(-1).toLocaleString('ja-JP')}円`:`税込${amounts[0].toLocaleString('ja-JP')}円`;
  return {...base,id,title,price:{...base.price,amount:amounts[0],text,from:amounts.length>1},context:{...base.context,service,days:'平日・土日祝',audience:'大人'},comparisonKey:`roan-compact|${id}`,comparisonEvidence:'reviewed-toyokawa-price-table',imageUrl:null,width:null,height:null};
}
function compactRoan(entries){
  const merged=[
    roanRange(entries,/旬菜ビュッフェ ランチ/,'旬菜ビュッフェ ランチ','ランチ','lunch'),
    roanRange(entries,/三元豚しゃぶと旬菜ビュッフェ/,'三元豚しゃぶと旬菜ビュッフェ','ディナー','pork-dinner'),
    roanRange(entries,/厳選牛しゃぶと旬菜ビュッフェ/,'厳選牛しゃぶと旬菜ビュッフェ','ディナー','beef-dinner')
  ].filter(Boolean);
  const reviewedDrinks=entries.filter(e=>e.kind==='drink'&&/（豊川店）/.test(String(e.title||'')));
  const drinks=reviewedDrinks.length?reviewedDrinks:entries.filter(e=>e.kind==='drink');
  return [...merged,...drinks];
}
function reviewedLayoutEntries(brandId,current,fallback){
  let entries=dedupeSemantic([...current,...fallback]);
  if(brandId==='washoku-sato'){
    const reviewed=reviewedSatoVersionRows(entries);
    if(reviewed.length)entries=entries.filter(e=>!/しゃぶしゃぶ・すき焼き.*さと式焼肉/.test(String(e.title||''))).concat(reviewed);
  }
  if(brandId==='syabuyo'){
    const priced=entries.filter(e=>knownPrice(e)&&/平日ディナー/.test(String(e.title||'')));
    if(priced.length)entries=entries.filter(e=>!(/平日ディナー/.test(String(e.title||''))&&!knownPrice(e)));
  }
  if(brandId==='roan')entries=compactRoan(entries);
  return dedupeSemantic(entries);
}
function renderSection(brand,entries,kind,shownImages){
  const p=presentationFor(brand.id),title=kind==='course'?'コース・料金':'飲み放題',rows=sectionRows(entries,kind,brand.id);
  const photoEnabled=kind==='course'?p.coursePhotos:p.drinkPhotos;
  const photos=photoEnabled?rows.filter(e=>e.imageUrl&&safe(e.imageUrl)&&Number(e.width)>=320&&Number(e.height)>=100&&!shownImages.has(e.imageUrl)&&!(brand.id==='yakiniku-king'&&kind==='course'&&/ランチ/.test(e.title))).map(e=>{shownImages.add(e.imageUrl);return e;}):[];
  const photoIds=new Set(photos.map(e=>e.id));
  let textRows=rows.filter(e=>!photoIds.has(e.id)||p.hideTextWhenPhoto===false);
  if(brand.id==='yuzuan'&&photos.length)textRows=textRows.filter(e=>/ランチ/.test(e.title)&&!photoIds.has(e.id));
  if(brand.id==='anrakutei'&&kind==='drink'&&photos.length)textRows=[];
  const photoHtml=photos.length?`<div class="catalog-photo-stack" data-photo-stack="${kind}">${photos.map(e=>photoTile(e,kind)).join('')}</div>`:'';
  const textHtml=textRows.length?`<div class="catalog-stack">${textRows.map(textTile).join('')}</div>`:'';
  const empty=kind==='drink'?'飲み放題プランの有無・料金は公式案内で確認':'料金は公式メニューで確認';
  return `<section class="catalog-section" data-catalog-section="${kind}"><h4>${title}</h4>${photoHtml}${textHtml}${!photos.length&&!textRows.length?`<p class="catalog-empty"><a href="${esc(safe(brand.homeUrl))}" target="_blank" rel="noopener noreferrer">${empty} ↗</a></p>`:''}</section>`;
}
export function renderCatalog(brand,data,fairs,media,now=new Date(),offersData=null){
  const current=selectCatalog(data,brand.id,fairs,now);
  const fallback=reviewedCatalogFallbacks(offersData,brand.id,current,now).filter(e=>catalogEntryVisible(brand.id,e));
  const entries=reviewedLayoutEntries(brand.id,current,fallback);
  const currentFairs=(fairs.campaigns||[]).filter(c=>c.brandId===brand.id&&['P1','P2'].includes(c.priority)&&campaignStatus(c,now).state==='active');
  const shownImages=new Set(selectMedia(currentFairs,brand.id,media,'active',now).map(e=>e.imageUrl));
  const sections=[renderSection(brand,entries,'course',shownImages),renderSection(brand,entries,'drink',shownImages)];
  const hasPrices=entries.some(knownPrice);
  return `<div class="brand-catalog" data-catalog-brand="${esc(brand.id)}">${sections.join('')}<p class="catalog-note">${hasPrices?'税込料金が確認できたものを優先し、同条件内は安い順です。':''}通常メニューと期間限定フェアは分けて表示しています。</p></div>`;
}
