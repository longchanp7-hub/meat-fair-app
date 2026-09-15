import {renderGallery,enhanceGalleries} from './gallery.mjs?v=20260915-final2';
import {campaignStatus} from './status.mjs';
import {activeOffers,selectHighlights,selectPromotions,selectFairRows} from './brand-details.mjs?v=20260915-final2';
const AREA_ORDER=['toyohashi','toyokawa','gamagori','okazaki','hamamatsu'];
const AREA_LABEL={toyohashi:'豊橋',toyokawa:'豊川',gamagori:'蒲郡',okazaki:'岡崎',hamamatsu:'浜松'};
const CAT_LABEL={yakiniku:'焼肉',shabu:'しゃぶしゃぶ',buffet:'ビュッフェ',steak:'ステーキ'};
const TAB_LABEL={active:'開催中',new:'新着',upcoming:'近日開始',ending:'終了間近'};
let tab='active',brandFilter=null,brandsData,fairsData,storesData,mediaData,offersData={offers:[]};
function esc(v=''){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function safeUrl(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'#'}catch{return'#'}}
function getState(c){return campaignStatus(c,new Date(),fairsData.statusRules?.newDays||7,fairsData.statusRules?.endingSoonDays||7);}
function status(c){return getState(c).state;}
function matchesTab(c,t=tab){const s=getState(c);return t==='new'?s.isNew&&s.state!=='ended':t==='ending'?s.endingSoon:s.state===t;}
function important(c){return ['P1','P2'].includes(c.priority);}
function countFor(id,t){return fairsData.campaigns.filter(c=>c.brandId===id&&important(c)&&matchesTab(c,t)).length;}
function health(id){return fairsData.sourceHealth?.find(h=>h.brandId===id)||{status:'needs_review',message:'開催状況を確認中です。'};}
function sortCampaigns(rows){return[...rows].sort((a,b)=>(a.priority==='P1'?0:1)-(b.priority==='P1'?0:1)||(b.startDate||'').localeCompare(a.startDate||''));}
function fmtDate(c){
 if(c.startDate&&c.endDate)return`${c.startDate} ～ ${c.endDate}`;
 if(c.startDate)return`${c.startDate} ～ ${c.endDateText||'終了日未記載'}`;
 if(c.endDate)return`～ ${c.endDate}`;
 if(c.startDateText)return c.startDateText;
 return c.endDateText||'開催中の掲載を確認／開始日・終了日は未確認';
}
function renderBrands(){
 const g=document.querySelector('#brand-grid');
 g.innerHTML=[...brandsData.brands].sort((a,b)=>a.order-b.order).map(b=>{
  const h=health(b.id),meta=h.status==='partial'?'<span class="meta">一部要確認</span>':'';
  return`<button class="brand ${brandFilter===b.id?'selected':''}" data-brand="${esc(b.id)}" aria-pressed="${brandFilter===b.id}"><b>${esc(b.name)}</b>${meta}</button>`;
 }).join('');
 document.querySelectorAll('.brand').forEach(el=>el.onclick=()=>{
  brandFilter=brandFilter===el.dataset.brand?null:el.dataset.brand;renderBrands();renderList();document.querySelector('#list-title')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 document.querySelector('#clear-filter').hidden=!brandFilter;
}
function storeState(c,s){
 const override=(s.campaignOverrides||[]).find(o=>c.title.includes(o.match));
 if(override)return override.available?'yes':'no';
 if((c.targetStores||[]).includes(s.id))return'yes';
 if((c.targetAreas||[]).includes(s.area))return'yes';
 return'unknown';
}
function brandAvailability(brandId,rows){
 const stores=(storesData.stores||[]).filter(s=>s.brandId===brandId);
 if(!stores.length)return'<p class="local-note">近隣店舗での実施・対象コースは公式サイトで確認してください。</p>';
 const chips=[];
 for(const area of AREA_ORDER){const ss=stores.filter(s=>s.area===area);if(!ss.length)continue;
  const states=rows.flatMap(c=>ss.map(s=>storeState(c,s))),symbol=states.includes('yes')?'○':states.length&&states.every(x=>x==='no')?'×':'△';
  chips.push(`<span class="area-chip ${symbol==='○'?'yes':symbol==='×'?'no':'unknown'}">${AREA_LABEL[area]} ${symbol}</span>`);
 }
 return`<div class="brand-availability"><span class="section-label">近隣エリア</span><div class="area-chips">${chips.join('')}</div><small>○ 対象確認済み　△ 対象要確認　× 対象外確認済み<br>同じチェーンでも店舗・コースごとに内容が異なります。</small></div>`;
}
function campaignRow(c){
 const tags=[c.allYouCanEat?'食べ放題':null,...(c.limitedIngredients||[]).slice(0,4)].filter(Boolean);
 const conditions=[c.weekdayCondition,...(c.conditions||[])].filter(Boolean);
 const state=status(c);
 return`<div class="fair-row" data-campaign="${esc(c.id)}" data-state="${state}"><div class="fair-row-main"><div class="fair-row-title"><a href="${esc(safeUrl(c.officialUrl))}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a><span class="priority ${c.priority==='P1'?'p1':'p2'}">${state==='upcoming'?'近日開始':'フェア'}</span></div><div class="fair-row-meta"><span>${esc(fmtDate(c))}</span>${c.priceText?`<strong>${esc(c.priceText)}</strong>`:''}</div>${c.targetCourses?.length?`<div class="courses">対象コース：${esc(c.targetCourses.join(' / '))}</div>`:''}${tags.length?`<div class="tags">${tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}${conditions.length?`<div class="conditions">${conditions.map(t=>`<p>${esc(t)}</p>`).join('')}</div>`:''}${c.verificationState==='last_known_good'?'<p class="data-note">取得ができなかったため、前回確認できた情報を表示しています。</p>':''}</div></div>`;
}
function offerTile(o,label){
 const cond=(o.conditions||[]).slice(0,3);
 return`<a class="info-tile" href="${esc(safeUrl(o.officialUrl))}" target="_blank" rel="noopener noreferrer"><small>${esc(label)}</small><b>${esc(o.title)}</b>${o.priceText?`<strong>${esc(o.priceText)}</strong>`:'<span class="price-unknown">料金は公式で確認</span>'}${cond.length?`<span class="tile-conditions">${esc(cond.join('・'))}</span>`:''}<span class="tile-source">公式情報 ↗</span></a>`;
}
function promoTile(c){
 const conditions=[c.weekdayCondition,...(c.conditions||[])].filter(Boolean).slice(0,2),state=status(c);
 return`<a class="info-tile promo-tile" data-campaign="${esc(c.id)}" data-state="${state}" href="${esc(safeUrl(c.officialUrl))}" target="_blank" rel="noopener noreferrer"><small>お得情報</small><b>${esc(c.title)}</b>${c.priceText?`<strong>${esc(c.priceText)}</strong>`:''}<span class="tile-conditions">${esc(fmtDate(c))}${conditions.length?'・'+conditions.join('・'):''}</span><span class="tile-source">公式条件を確認 ↗</span></a>`;
}
function highlightTile(a){
 return`<a class="info-tile highlight-tile" href="${esc(safeUrl(a.officialUrl))}" target="_blank" rel="noopener noreferrer"><small>注目メニュー</small><b>${esc(a.title)}</b><span class="tile-source">公式メニュー ↗</span></a>`;
}
function renderBrandDetails(brand,rows){
 const promos=selectPromotions(rows),parts=[];
 if(promos.length)parts.push(`<section class="info-section"><h4>お得なキャンペーン・特典</h4><div class="info-grid">${promos.map(promoTile).join('')}</div></section>`);
 if(tab!=='active')return parts.join('');
 const courses=activeOffers(offersData,brand.id,'course').slice(0,6);
 parts.push(`<section class="info-section"><h4>食べ放題・コース料金</h4><div class="info-grid">${courses.length?courses.map(o=>offerTile(o,'通常コース')).join(''):`<a class="info-tile link-only" href="${esc(safeUrl(brand.homeUrl))}" target="_blank" rel="noopener noreferrer"><small>コース・料金</small><b>公式メニューで料金を確認</b><span class="price-unknown">推測価格は表示しません</span><span class="tile-source">公式サイト ↗</span></a>`}</div></section>`);
 const highlights=selectHighlights(mediaData,brand.id,rows).slice(0,2);
 if(highlights.length)parts.push(`<section class="info-section"><h4>上位コースで注目したいメニュー</h4><div class="info-grid">${highlights.map(highlightTile).join('')}</div></section>`);
 const drinks=activeOffers(offersData,brand.id,'drink').slice(0,4);
 if(drinks.length)parts.push(`<section class="info-section"><h4>飲み放題</h4><div class="info-grid">${drinks.map(o=>offerTile(o,/ソフト|ドリンクバー/.test(o.title)?'ソフトドリンク':'飲み放題')).join('')}</div></section>`);
 return parts.join('');
}
function brandCard(brand,rows){
 const sorted=sortCampaigns(rows),fairRows=selectFairRows(sorted),h=health(brand.id);
 let body='';
 if(fairRows.length)body=`<div class="section-title"><span>${TAB_LABEL[tab]}のフェア</span></div><div class="fair-list">${fairRows.map(campaignRow).join('')}</div>${h.status==='partial'?'<p class="data-note">一部の公式情報は再確認が必要です。</p>':''}`;
 else if(!sorted.length){const upcoming=countFor(brand.id,'upcoming');body=`<div class="empty-brand"><b>${h.status==='unavailable'?'公式情報の取得に制限があります':upcoming?'近日開始のフェアがあります':'この条件のフェアは未確認です'}</b><p>${h.status==='unavailable'?'「フェアなし」とは判断していません。開催状況は公式サイトで確認してください。':upcoming?'上の「近日開始」タブで確認できます。':'取得済みの情報に、この条件の開催フェアはありません。最新情報は公式サイトで確認してください。'}</p></div>`;}
 const details=renderBrandDetails(brand,sorted);
 return`<article class="restaurant-card" id="brand-${esc(brand.id)}" data-brand-card="${esc(brand.id)}"><div class="restaurant-head"><div><div class="category">${esc(CAT_LABEL[brand.category]||'レストラン')}</div><h3>${esc(brand.name)}</h3><div class="restaurant-summary">${esc(TAB_LABEL[tab])}${h.status==='partial'?' ・ 一部要確認':''}</div></div><span class="brand-rank">${String(brand.order).padStart(2,'0')}</span></div>${renderGallery(sorted,brand,mediaData,tab)}<div class="restaurant-body">${body}${details}${brandAvailability(brand.id,sorted)}<a class="brand-official" href="${esc(safeUrl(brand.homeUrl))}" target="_blank" rel="noopener noreferrer">${esc(brand.name)} 公式サイトへ <span>↗</span></a></div></article>`;
}
function renderList(){
 const suffix=brandFilter?` ・ ${brandsData.brands.find(b=>b.id===brandFilter)?.name||''}`:'';
 document.querySelector('#list-title').textContent=TAB_LABEL[tab]+suffix;
 const rows=fairsData.campaigns.filter(c=>important(c)&&matchesTab(c));
 const brands=[...brandsData.brands].sort((a,b)=>a.order-b.order).filter(b=>(!brandFilter||b.id===brandFilter)&&(tab==='active'||brandFilter||rows.some(c=>c.brandId===b.id)));
 document.querySelector('#campaign-list').innerHTML=brands.length?brands.map(b=>brandCard(b,rows.filter(c=>c.brandId===b.id))).join(''):'<div class="empty">この条件で表示できるフェアはありません。</div>';
 enhanceGalleries();
}
function renderHeader(){
 const checked=fairsData.sourceHealth?.filter(h=>h.sourceOk).length||0;
 document.querySelector('#data-status').textContent=`全${brandsData.brands.length}チェーンを確認対象に設定 ・ 公式情報取得 ${checked}/${brandsData.brands.length}チェーン`;
 document.querySelector('#updated-at').textContent=fairsData.updatedAt?'最終取得：'+new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(fairsData.updatedAt))+'（日本時間）':'';
}
async function getJson(path){const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw Error('データを取得できませんでした');return r.json();}
try{
 [brandsData,fairsData,storesData,mediaData,offersData]=await Promise.all([getJson('./data/brands.json'),getJson('./data/fairs.json'),getJson('./data/stores.json').catch(()=>({stores:[]})),getJson('./data/gallery.json').catch(()=>({assets:[]})),getJson('./data/offers.json').catch(()=>({offers:[]}))]);
 if(!Array.isArray(brandsData.brands)||!Array.isArray(fairsData.campaigns))throw Error('データの形式が不正です');
 document.querySelectorAll('#status-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
 document.querySelectorAll('#status-tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('#status-tabs button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderList();});
 document.querySelector('#clear-filter').onclick=()=>{brandFilter=null;renderBrands();renderList();};
 renderHeader();renderBrands();renderList();document.body.dataset.ready='true';startAutomaticRefresh();
}catch(e){document.querySelector('#campaign-list').textContent='データを読み込めませんでした。通信状況を確認して再読み込みしてください。';document.body.dataset.ready='error';console.error(e);}

function startAutomaticRefresh(){
 let busy=false,lastCheck=Date.now();
 const signature=()=>JSON.stringify([fairsData.updatedAt,mediaData?.updatedAt,offersData?.updatedAt,fairsData.campaigns.map(getState),(Array.isArray(mediaData?.assets)?mediaData.assets:[]).map(a=>Date.now()-Date.parse(a.checkedAt)<=172800000),(Array.isArray(offersData?.offers)?offersData.offers:[]).map(o=>o.id)]);
 let rendered=signature();
 const update=async()=>{
  if(document.hidden||busy||Date.now()-lastCheck<60000)return;
  busy=true;lastCheck=Date.now();
  const anchor=[...document.querySelectorAll('[data-brand-card]')].find(el=>el.getBoundingClientRect().bottom>80);
  const anchorId=anchor?.id,anchorTop=anchor?.getBoundingClientRect().top;
  try{
   const [nextFairs,nextMedia,nextOffers]=await Promise.all([getJson('./data/fairs.json'),getJson('./data/gallery.json').catch(()=>mediaData),getJson('./data/offers.json').catch(()=>offersData)]);
   if(!Array.isArray(nextFairs?.campaigns))throw Error('Invalid refreshed data');
   fairsData=nextFairs;mediaData=nextMedia;offersData=nextOffers;renderHeader();
  }catch(error){console.warn('最新データを取得できないため前回の情報を表示します',error);}
  finally{
   const next=signature();if(next===rendered){busy=false;return;}rendered=next;
   renderBrands();renderList();
   if(anchorId)requestAnimationFrame(()=>{const current=document.getElementById(anchorId);if(current)window.scrollBy(0,current.getBoundingClientRect().top-anchorTop);});
   busy=false;
  }
 };
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
 window.addEventListener('pageshow',update);
 setInterval(update,300000);
}
