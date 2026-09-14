import {planGallery} from './gallery-plan.mjs';
const DAY=86400000;
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
// Heading/price-label fragments are not supplementary photographs. Verified
// campaign posters are deliberately exempt; this policy only filters extras.
export function isSupplementaryPhoto(value){
  try{return !/(?:^|[\/_-])(?:title|text|sign)(?:[_-](?:pc|sp|mobile|desktop|\d+))?\.(?:jpe?g|png|webp|gif|avif)$/i.test(decodeURIComponent(new URL(value).pathname));}
  catch{return false;}
}
export function mediaCaption(value){
  const original=String(value??'').replace(/\s+/g,' ').trim();
  // Extract only an explicitly tax-inclusive amount. Never calculate tax, infer
  // a missing price, or turn an add-on charge into the price of a course.
  const match=original.match(/(?:(?:[￥¥]\s*\d[\d,]*|\d[\d,]*\s*円)\s*)?[（(]\s*税込\s*[:：]?\s*[￥¥]?\s*(\d[\d,]*)\s*円?\s*[）)]\s*([〜～~])?/u);
  if(!match)return {title:original,price:''};
  let before=original.slice(0,match.index).trim(),after=original.slice(match.index+match[0].length).trim();
  if(/[＋+]\s*$|追加|差額|ひとつの鍋|一つの鍋/.test(before))return {title:original,price:''};
  before=before.replace(/[／/]?\s*お一人様\s*$/u,'').trim();
  const hasName=/食べ放題|コース|フェア|ステーキ|ハンバーグ|ランチ/.test(before);
  const hasCondition=/限定|平日|土日|祝日|店舗|ディナー|ランチ/.test(after);
  const title=(hasName&&!hasCondition?before:[before,after].filter(Boolean).join(' '))||original;
  return {title,price:`税込${match[1]}円${match[2]?'〜':''}`};
}
export function selectMedia(rows,brandId,data={},tab='active',now=new Date()){
  const available=(Array.isArray(data?.assets)?data.assets:[]).filter(a=>a.brandId===brandId);
  const fresh=a=>{const age=+now-Date.parse(a.checkedAt);return age>=0&&age<=2*DAY;};
  const selected=[], seen=new Set();
  const push=a=>{const u=url(a.imageUrl),href=url(a.officialUrl);if(!u||!href||seen.has(u))return;seen.add(u);selected.push({...a,imageUrl:u,officialUrl:href});};
  for(const [i,c] of rows.entries()){
    const assets=available.filter(a=>a.campaignId===c.id&&a.parentHash===c.contentHash);
    const main=assets.find(a=>a.kind==='campaign');
    const extras=assets.filter(a=>a.kind==='detail'&&fresh(a)&&isSupplementaryPhoto(a.imageUrl));
    const representative=main||(!c.imageUrl?(extras.find(a=>/フェア|キャンペーン|割引|OFF/.test(a.title))||extras[0]):null);
    const imageUrl=representative?.imageUrl||c.imageUrl;
    if(imageUrl)push({...representative,brandId,campaignId:c.id,kind:'campaign',campaignType:c.campaignType,imageUrl,officialUrl:c.officialUrl,title:c.title,rank:i===0?0:10});
  }
  for(const c of rows)for(const a of available.filter(a=>a.campaignId===c.id&&a.parentHash===c.contentHash&&a.kind==='detail')){
    if(fresh(a)&&isSupplementaryPhoto(a.imageUrl))push(a);
  }
  if(tab==='active')for(const a of available.filter(a=>a.kind==='menu')){
    if(fresh(a)&&isSupplementaryPhoto(a.imageUrl))push(a);
  }
  return selected.sort((a,b)=>(a.rank??30)-(b.rank??30));
}
export function renderGallery(rows,brand,data,tab){
  const assets=selectMedia(rows,brand.id,data,tab);
  if(!assets.length)return '';
  return `<div class="media-section"><div class="gallery adaptive-gallery" data-media-count="${assets.length}" aria-label="${html(brand.name)}の公式画像">${assets.map((a,i)=>{
    const w=Number(a.width)||0,h=Number(a.height)||0,ratio=w>0&&h>0?w/h:1;
    const label=a.kind==='campaign'?(a.campaignType==='discount'?'割引・キャンペーン':'フェア'):a.kind==='detail'?'フェア内メニュー':'公式メニュー';
    const caption=mediaCaption(a.title);
    return `<a class="gallery-item media-tile ${i===0?'main':''}" href="${html(a.officialUrl)}" target="_blank" rel="noopener noreferrer" data-ratio="${ratio}" data-kind="${html(a.kind)}" title="${html(a.title)}" aria-label="${html(a.title)}：公式ページを開く"><img src="${html(a.imageUrl)}" alt="${html(a.title)}" ${w&&h?`width="${w}" height="${h}"`:''} loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="media-caption${caption.price?' has-price':''}"><small>${label}</small><span class="media-title">${html(caption.title)}</span>${caption.price?`<strong class="media-price">${html(caption.price)}</strong>`:''}</span></a>`;
  }).join('')}</div><div class="media-fallbacks" aria-live="polite"></div>${assets.some(a=>a.kind==='menu')?'<p class="media-disclaimer">関連メニューはフェア件数に含めていません。店舗・曜日・料金などの条件は各画像の公式ページで確認してください。</p>':''}</div>`;
}
let cleanups=[];
export function enhanceGalleries(root=document){
  cleanups.forEach(fn=>fn());cleanups=[];
  for(const gallery of root.querySelectorAll('.adaptive-gallery')){
    let frame=0,disposed=false;
    const render=()=>{
      frame=0;if(disposed||!gallery.isConnected)return;
      const tiles=[...gallery.querySelectorAll('.media-tile')];
      const width=gallery.clientWidth;if(!width)return;
      // Larger accessibility text also needs wider tiles, not merely taller captions.
      const scale=Math.max(1,(parseFloat(getComputedStyle(document.documentElement).fontSize)||16)/16);
      const items=tiles.map(t=>({ratio:Number(t.dataset.ratio)||1,captionHeight:(parseFloat(getComputedStyle(t.querySelector('.media-caption')).height)||64)/scale,kind:t.dataset.kind}));
      const plan=planGallery(items,width/scale,6/scale);
      plan.height*=scale;
      for(const b of plan.boxes)for(const key of ['x','y','width','height','imageHeight'])b[key]*=scale;
      gallery.classList.add('is-packed');gallery.style.height=plan.height+'px';gallery.dataset.layout=plan.mode;
      for(const b of plan.boxes){const t=tiles[b.index];Object.assign(t.style,{left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px'});t.style.setProperty('--image-height',b.imageHeight+'px');}
    };
    const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(render);};
    let oldWidth=-1;
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{const w=entries[0].contentRect.width;if(Math.abs(w-oldWidth)>.5){oldWidth=w;schedule();}}):null;
    observer?.observe(gallery);
    const captionHeights=new WeakMap();
    const captionObserver=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
      let changed=false;
      for(const e of entries){const h=e.contentRect.height;if(Math.abs(h-(captionHeights.get(e.target)??-1))>.5){captionHeights.set(e.target,h);changed=true;}}
      if(changed)schedule();
    }):null;
    for(const caption of gallery.querySelectorAll('.media-caption'))captionObserver?.observe(caption);
    if(!observer)window.addEventListener('resize',schedule);
    for(const tile of gallery.querySelectorAll('.media-tile')){
      const image=tile.querySelector('img');
      const loaded=()=>{if(image.naturalWidth){tile.dataset.ratio=String(image.naturalWidth/image.naturalHeight);schedule();}};
      const failed=()=>{
        if(disposed||!tile.isConnected)return;
        const link=document.createElement('a');link.href=tile.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`画像を取得できません：${image.alt} ↗`;link.className='media-unavailable';
        gallery.parentElement.querySelector('.media-fallbacks').append(link);tile.remove();gallery.dataset.mediaCount=String(gallery.childElementCount);schedule();
      };
      image.addEventListener('load',loaded);image.addEventListener('error',failed,{once:true});
      if(image.complete){if(image.naturalWidth)loaded();else if(image.currentSrc)failed();}
      cleanups.push(()=>{image.removeEventListener('load',loaded);image.removeEventListener('error',failed);});
    }
    render();
    cleanups.push(()=>{disposed=true;observer?.disconnect();captionObserver?.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);});
  }
}
