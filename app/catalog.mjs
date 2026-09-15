import {campaignStatus} from './status.mjs';
import {renderMediaAssets,selectMedia} from './gallery.mjs?v=20260915-catalog1';
const TTL=48*60*60*1000;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export function catalogEntryCurrent(e,fairs,now=new Date(),generationMatches=true){
  const age=+now-Date.parse(e.checkedAt);
  if(!Number.isFinite(age)||age<0||age>TTL||!safe(e.sourceUrl)||!safe(e.officialUrl))return false;
  if(!e.campaignId)return true; // Independently sourced regular menus survive fair changes.
  return generationMatches&&(fairs.campaigns||[]).some(c=>c.id===e.campaignId&&c.brandId===e.brandId&&c.contentHash===e.parentHash&&campaignStatus(c,now).state==='active');
}
export function selectCatalog(data,brandId,fairs,now=new Date()){
  if(data?.schemaVersion!==1||!Array.isArray(data.entries))return [];
  const generationMatches=data.fairsUpdatedAt===fairs.updatedAt;
  const used=new Set();
  return data.entries.filter(e=>e.brandId===brandId&&['course','highlight','drink'].includes(e.kind)&&catalogEntryCurrent(e,fairs,now,generationMatches)).filter(e=>{if(used.has(e.id))return false;used.add(e.id);return true;}).map(e=>({...e,verificationState:!generationMatches?'last_known_good':e.verificationState}));
}
export function groupCoursePrices(entries){
  const groups=new Map();
  for(const e of entries){
    // Incomplete context is never silently treated as a comparable adult rate.
    const context=e.context||{},ambiguous=['service','days','audience'].some(k=>!context[k]||context[k]==='未確認');
    const key=(e.comparisonKey||e.sourceUrl)+(ambiguous&&!e.comparisonEvidence?'|'+e.id:'');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
  }
  return [...groups.values()].map(group=>group.sort((a,b)=>{
    const price=e=>Number.isFinite(e.price?.amount)&&e.price?.taxIncluded===true?e.price.amount:Infinity;
    return price(a)-price(b)||(a.rank??100)-(b.rank??100)||a.title.localeCompare(b.title,'ja');
  }));
}
function shortConditions(e){
  const c=e.context||{},parts=[c.service,c.days,c.audience,c.channel==='通常掲載'?null:c.channel,c.charge==='追加料金'?'コースに追加する料金':null].filter(x=>x&&x!=='未確認'&&!/^公式/.test(x));
  const evidence=(e.evidenceText||'').split('公式HTML画像 ')[0];
  const duration=evidence.match(/(?:制限時間|食べ放題|飲み放題)?\s*(\d{2,3})\s*分(?:制|間)?/u);
  if(duration)parts.push(duration[0].trim());
  const lo=evidence.match(/(?:ラストオーダー|\bL\.?O\.?(?![A-Za-z]))\s*[^。]{0,25}/iu);if(lo)parts.push(lo[0]);
  return [...new Set(parts)];
}
function textTile(e){
  const conditions=shortConditions(e),known=Number.isFinite(e.price?.amount)&&e.price?.taxIncluded===true;
  const price=known?e.price.text:e.price?.rawText?e.price.rawText:e.kind==='highlight'?(e.targetCourses?.length?'掲載コース：'+e.targetCourses.join('／'):'対象コース・単品条件を確認'):e.imageUrl?'料金は公式画像・店舗で確認':'料金は公式で要確認';
  const label=e.context?.subBrand?e.context.subBrand:e.kind==='drink'?(e.planExistence==='menu_only'?'公式ドリンクメニュー':/ノンアルコール|オールフリー/.test(e.title)?'ノンアルコール':/アルコール|生ビール|ハイボール|酒/.test(e.title)?'アルコール':/ソフト|ドリンクバー/.test(e.title)?'ソフトドリンク':'飲み放題'):
    e.kind==='highlight'?(e.exclusive?'対象コース限定':'注目メニュー'):'通常メニュー';
  const details=[...(e.conditions||[]),e.targetCourses?.length?'掲載コース：'+e.targetCourses.join('／'):null].filter(Boolean);
  return `<article class="catalog-card" data-catalog-id="${esc(e.id)}" data-catalog-kind="${esc(e.kind)}" data-price="${known?e.price.amount:''}" data-context="${esc(e.comparisonKey||e.sourceUrl)}"><span class="catalog-label">${esc(label)}</span><h5><a href="${esc(safe(e.officialUrl))}" target="_blank" rel="noopener noreferrer">${esc(e.title)} ↗</a></h5><strong class="catalog-price${known?'':' unconfirmed'}">${esc(price)}</strong>${conditions.length?`<p class="catalog-terms">${esc(conditions.join(' · '))}</p>`:''}${e.verificationState==='last_known_good'?'<p class="catalog-stale">前回の確認情報</p>':''}${details.length?`<details class="catalog-details"><summary>対象・利用条件</summary>${[...new Set(details)].map(s=>`<p>${esc(s)}</p>`).join('')}</details>`:''}</article>`;
}
export function renderCatalog(brand,data,fairs,media,now=new Date()){
  const entries=selectCatalog(data,brand.id,fairs,now);
  const currentFairs=(fairs.campaigns||[]).filter(c=>c.brandId===brand.id&&['P1','P2'].includes(c.priority)&&campaignStatus(c,now).state==='active');
  const shownImages=new Set(selectMedia(currentFairs,brand.id,media,'active',now).map(e=>e.imageUrl));
  const sections=[];
  for(const [kind,title]of [['highlight','注目メニュー'],['course','通常コース・料金'],['drink','飲み放題・ドリンクバー']]){
    const rows=entries.filter(e=>e.kind===kind);if(!rows.length&&kind==='highlight')continue;
    const groups=kind==='highlight'?[rows.sort((a,b)=>Number(b.exclusive)-Number(a.exclusive)||(a.rank??100)-(b.rank??100))]:groupCoursePrices(rows);
    const ordered=groups.flat();
    const photos=ordered.filter(e=>e.imageUrl&&safe(e.imageUrl)&&e.width>=320&&e.height>=100&&!shownImages.has(e.imageUrl)).map(e=>{
      shownImages.add(e.imageUrl);return{...e,kind:'menu',group:kind,visualWeight:1,label:kind==='highlight'?'公式の注目メニュー':kind==='drink'?'飲み放題・ドリンクバー':'公式コース・料金',title:e.title+(kind==='highlight'&&e.targetCourses?.length?'［'+e.targetCourses.join('／')+'］':e.price?.text?' '+e.price.text:''),priority:e.exclusive?20:30};
    });
    const images=renderMediaAssets(photos,brand.name,'catalog');
    const empty=kind==='drink'?'飲み放題プランの有無・料金は店舗の公式案内で要確認。':'店舗・時間帯により料金が異なります。公式メニューで確認してください。';
    sections.push(`<section class="catalog-section" data-catalog-section="${kind}"><h4>${title}</h4>${images}${rows.length?groups.map(group=>`<div class="catalog-grid">${group.filter(e=>kind!=='highlight'||!photos.some(p=>p.id===e.id)).map(textTile).join('')}</div>`).join(''):`<p class="catalog-empty"><a href="${esc(safe(brand.homeUrl))}" target="_blank" rel="noopener noreferrer">${empty} ↗</a></p>`}</section>`);
  }
  const hasPrices=entries.some(e=>Number.isFinite(e.price?.amount));
  return `<div class="brand-catalog" data-catalog-brand="${esc(brand.id)}">${sections.join('')}<p class="catalog-note">${hasPrices?'同じ掲載元・利用条件の中で税込料金の安い順に表示。':''}通常メニューと期間限定企画は別の情報です。掲載価格が近隣全店で適用されるとは限りません。</p></div>`;
}
