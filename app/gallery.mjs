import {planGallery} from './gallery-plan.mjs';
const DAY=86400000;
const MEDIA_ORDER={campaign:0,detail:1,menu:2};
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
export function selectMedia(rows,brandId,data={},tab='active',now=new Date()){
  const available=(Array.isArray(data?.assets)?data.assets:[]).filter(a=>a.brandId===brandId);
  const selected=[], seen=new Set();
  const push=a=>{const u=url(a.imageUrl),href=url(a.officialUrl);if(!u||!href||seen.has(u))return;seen.add(u);selected.push({...a,imageUrl:u,officialUrl:href});};
  for(const [i,c] of rows.entries()){
    const assets=available.filter(a=>a.campaignId===c.id&&a.parentHash===c.contentHash);
    const main=assets.find(a=>a.kind==='campaign');
    if(c.imageUrl)push({...main,brandId,campaignId:c.id,kind:'campaign',imageUrl:main?.imageUrl||c.imageUrl,officialUrl:c.officialUrl,title:c.title,rank:i===0?0:10});
  }
  for(const c of rows)for(const a of available.filter(a=>a.campaignId===c.id&&a.parentHash===c.contentHash&&a.kind==='detail')){
    const age=+now-Date.parse(a.checkedAt);
    if(age>=0&&age<=2*DAY)push(a);
  }
  if(tab==='active')for(const a of available.filter(a=>a.kind==='menu')){
    const age=+now-Date.parse(a.checkedAt);
    if(age>=0&&age<=2*DAY)push(a);
  }
  // Category order also applies to last-known-good records with older rank values.
  // Keep the main fair and its food ahead of unrelated lunch/banquet promotions.
  return selected.sort((a,b)=>(MEDIA_ORDER[a.kind]??3)-(MEDIA_ORDER[b.kind]??3)||(a.rank??30)-(b.rank??30));
}
export function renderGallery(rows,brand,data,tab){
  const assets=selectMedia(rows,brand.id,data,tab);
  if(!assets.length)return '';
  return `<div class="media-section"><div class="gallery adaptive-gallery" data-media-count="${assets.length}" aria-label="${html(brand.name)}の公式画像">${assets.map((a,i)=>{
    const w=Number(a.width)||0,h=Number(a.height)||0,ratio=w>0&&h>0?w/h:1;
    const label=a.kind==='campaign'?'フェア':a.kind==='detail'?'フェア内のメニュー':'公式メニュー・関連情報';
    return `<a class="gallery-item media-tile ${i===0?'main':''}" href="${html(a.officialUrl)}" target="_blank" rel="noopener noreferrer" data-ratio="${ratio}" data-kind="${html(a.kind)}" title="${html(a.title)}" aria-label="${html(a.title)}：公式ページを開く"><img src="${html(a.imageUrl)}" alt="${html(a.title)}" ${w&&h?`width="${w}" height="${h}"`:''} loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="media-caption"><small>${label}</small><span>${html(a.title)}</span></span></a>`;
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
      const items=tiles.map(t=>({ratio:Number(t.dataset.ratio)||1,captionHeight:56,kind:t.dataset.kind}));
      const plan=planGallery(items,width,6);
      gallery.classList.add('is-packed');gallery.style.height=plan.height+'px';gallery.dataset.layout=plan.mode;
      for(const b of plan.boxes){const t=tiles[b.index];Object.assign(t.style,{left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px'});t.style.setProperty('--image-height',b.imageHeight+'px');}
    };
    const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(render);};
    let oldWidth=-1;
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{const w=entries[0].contentRect.width;if(Math.abs(w-oldWidth)>.5){oldWidth=w;schedule();}}):null;
    observer?.observe(gallery);
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
    cleanups.push(()=>{disposed=true;observer?.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);});
  }
}
