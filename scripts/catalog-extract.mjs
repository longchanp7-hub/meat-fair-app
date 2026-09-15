import crypto from 'node:crypto';
import {reviewCatalogImage} from './catalog-reviewed-images.mjs';
import {profileCatalog} from './catalog-profiles.mjs';
import {parseHtml, all, one, text, links, httpUrl} from './html-document.mjs';
import {publicUrl, imageKey} from './gallery-extract.mjs';

const COURSE=/食べ放題|コース|ビュッフェ|バイキング|サラダバー|(?<!ク)ランチ(?!ャ)|ディナー|グランドメニュー|料金表|価格表/;
const DRINK=/飲み放題|ドリンクバー|フリードリンク/;
const PREMIUM=/厚切り|牛タン|牛たん|黒毛和牛|和牛|黒豚|国産牛|骨付き|特選|名物|ずわい|ズワイ|蟹|かに|海鮮|大海老|大ホタテ|ローストビーフ/;
const NOISE=/フランチャイズ|加盟店|注意事項|ご利用について|全コース共通|こちらから|採用|求人|アンケート|抽選|フォロー|リポスト|プレゼント|アレルギー|原産地|栄養成分|テイクアウト|持ち帰り|お支払い|店舗検索|お問い合わせ|閉店|休業/;
const DECORATION=/(?:logo|icon|qrcode|qr_|button|btn_|arrow|sprite|footer|header|bg[_.-]|spacer|loading|(?:^|[_/-])(?:title|text|sign|ttl)[_.-])/i;
const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
export const contentHash=s=>crypto.createHash('sha256').update(s).digest('hex');
export function priceEvidence(value=''){
  const s=clean(value),matches=[];
  // Only explicitly tax-inclusive amounts; never calculate tax or choose a
  // child's/add-on price as a course total. Multiple amounts remain unsorted.
  const patterns=[/(?:税込(?:価格|料金)?\s*[:：]?\s*[¥￥]?\s*)([0-9][0-9,]*(?:\.[0-9]+)?)\s*円?\s*([〜～~]|から)?/gu,/[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*円?\s*[（(]\s*税込\s*[）)]\s*([〜～~]|から)?/gu];
  for(const re of patterns)for(const m of s.matchAll(re)){
    const amount=Number(m[1].replaceAll(',',''));
    if(Number.isFinite(amount)&&amount>0&&amount<1000000)matches.push({amount,from:!!m[2],index:m.index,raw:m[0]});
  }
  const amounts=[...new Set(matches.map(m=>m.amount))];
  if(amounts.length!==1)return {amount:null,text:null,taxIncluded:null,from:false};
  const m=matches.find(m=>m.amount===amounts[0]);
  const from=matches.some(x=>x.from)||/[〜～~]\s*$/.test(s.slice(m.index+m.raw.length,m.index+m.raw.length+3));
  return {amount:m.amount,text:`税込${m.amount.toLocaleString('ja-JP')}円${from?'〜':''}`,taxIncluded:true,from};
}
export function comparisonContext(evidence='',kind='course'){
  const s=clean(evidence);
  const values=re=>[...new Set([...s.matchAll(re)].map(m=>m[0]))].sort();
  return {
    service:values(/ランチ|ディナー/gu).join('・')||'未確認',
    days:values(/平日|土日祝(?:日)?|土日|土曜|日曜|祝日/gu).join('・')||'未確認',
    audience:values(/大人|小学生|幼児|シニア|中学生以上|\d+歳以上/gu).join('・')||'未確認',
    channel:values(/ネット予約|Web予約|WEB予約|アプリ(?:会員)?|会員限定/gu).join('・')||'通常掲載',
    charge:/追加|[+＋]\s*\d|別途|差額/.test(s)?'追加料金':kind==='drink'?'飲み物料金':'コース・メニュー料金'
  };
}
export function conditionEvidence(value=''){
  const s=clean(value);
  return s.split(/(?<=[。!！])\s*|[\n\r]+/u).filter(t=>/平日|土日|祝日|限定|店舗|対象|追加|別途|コース|予約|大人|小学生|シニア|\d+分|ラストオーダー|L\.?O\.?|食べ放題では|お肉.*[2２]皿/.test(t)).map(t=>t.trim()).filter(Boolean);
}
function excluded(node,root){
  for(let n=node;n&&n!==root;n=n.parent)if(['header','footer','nav','aside'].includes(n.tag)||/breadcrumb|sidebar|footer|gnav|global.?nav/i.test(n.attrs?.class||''))return true;
  return false;
}
function photoNodes(node,base,{allowSmall=false}={}){
  const out=[];
  for(const n of all(node,'img')){
    const a=n.attrs;
    const raw=a['data-src']||a['data-original']||a.src||a.srcset?.split(/[ ,]/)[0];
    const u=raw&&publicUrl(raw,base);
    if(!u||! /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(u)||DECORATION.test(new URL(u).pathname))continue;
    if(!allowSmall&&((+a.width>0&&+a.width<280)||(+a.height>0&&+a.height<80)))continue;
    out.push({imageUrl:u,title:clean(a.alt),node:n});
  }
  const map=new Map();
  for(const a of out){const k=imageKey(a.imageUrl),old=map.get(k);if(!old||/[_/-](sp|mobile)[_.-]/i.test(a.imageUrl))map.set(k,a);}
  return [...map.values()];
}
function contextFor(node,root){
  let best=node;
  for(let n=node.parent,depth=0;n&&n!==root&&depth<4;n=n.parent,depth++){
    if(['header','footer','nav','aside'].includes(n.tag))break;
    const t=text(n),headings=all(n,'h1,h2,h3,h4,dt').filter(h=>COURSE.test(text(h))||DRINK.test(text(h)));
    if(t.length>1700||headings.length>2)break;
    best=n;
    if(/[¥￥円]|飲み放題|ドリンクバー/.test(t)&&t.length>text(node).length+8)break;
    if(n.tag==='a'||['figure','li','tr'].includes(n.tag))break;
  }
  return best;
}
function kindFor(title,evidence,options={}){
  if(DRINK.test(title)&&!/(?:飲み放題|ドリンクバー)(?:付き|付|込|を含む)/.test(title))return 'drink';
  if(COURSE.test(title)&&! /以上をご注文|に含まれ|でお楽しみ|の方|対象コース|コース限定.*(?:カルビ|タン)/.test(title))return 'course';
  if(PREMIUM.test(title)&&! /フェア|キャンペーン|祭り|フェス/.test(title))return 'highlight';
  if(options.isMenuPage&&/メニュー|料金/.test(title)&&options.hasImage)return 'course';
  return null;
}
function shortTitle(raw){
  return clean(raw).replace(/\s*[|｜].*$/,'').replace(/(?:お一人様)?\s*[¥￥]?\s*\d[\d,]*\s*(?:円|\(税込)[\s\S]*$/,'').trim();
}
function targetCourses(evidence){
  const out=[...clean(evidence).matchAll(/(?:^|[\s、。／/「『【])([^\s、。／/「『【]{2,30}コース)/gu)].map(m=>m[1]);
  return [...new Set(out)].filter(s=>!/^対象|^ご注文|^上記|^いずれか/.test(s));
}
export function extractCatalogPage(html,sourceUrl,brand,{checkedAt=new Date().toISOString(),campaign=null}={}){
  const doc=parseHtml(html),root=one(doc,'main,#main,#contents,.area-contents,body')||doc;
  const body=text(root);
  if((body.length<40&&photoNodes(root,sourceUrl).length===0)||/verify you are human|checking your browser|access denied|captcha challenge/i.test(body))throw Error('unreadable_or_challenge_page');
  const canonical=httpUrl(sourceUrl,sourceUrl),sourceHash=contentHash(body+'\n'+all(root,'img').map(n=>n.attrs['data-src']||n.attrs.src||'').join('\n'));
  const isMenuPage=/menu|course|price|drink|lunch|dinner|enkai|buffet|tabehodai|tabehoudai|nomihodai|plan/i.test(new URL(sourceUrl).pathname+new URL(sourceUrl).search);
  const items=[],seen=new Set();
  const profile=profileCatalog(brand,root,sourceUrl,{photos:photoNodes,campaign});
  if(profile!==null){
    for(const [rank,candidate] of profile.entries()){
      const c=reviewCatalogImage(candidate,canonical,sourceHash);if(!c)continue;
      const evidence=clean(c.evidence||text(c.node));
      const title=clean(c.title);
      if(!title||NOISE.test(title)||!evidence||/販売終了|提供終了|終了しました/.test(evidence))continue;
      const price=priceEvidence(c.priceEvidence||'');
      if(price.amount===null&&c.priceEvidence&&c.priceEvidence.length<150&&/[円¥￥]/.test(c.priceEvidence))price.rawText=clean(c.priceEvidence);
      if(c.freeText){price.amount=0;price.text=c.freeText;price.taxIncluded=true;price.included=true;}
      const context=comparisonContext(c.priceEvidence||evidence,c.kind);
      context.subBrand=c.subBrand||'';
      if(c.kind==='course'&&c.comparisonGroup)context.charge=/追加オプション/.test(title)?'オプション込みコース総額':'コース料金';
      context.scope=c.comparisonGroup||canonical;
      // A course table explicitly establishes one shared base-price category.
      // Its exceptions stay attached, instead of mixing them into that category.
      const comparisonEvidence=c.comparisonGroup?'same-official-course-table':null;
      if(comparisonEvidence){context.audience='公式の基本料金';context.service=/ランチ/.test(title)?'ランチ':'公式掲載枠';context.days='公式掲載条件';}
      const key=[c.kind,title,price.amount??'',c.subBrand||'',c.comparisonGroup||canonical].join('|');
      const officialUrl=c.officialUrl||sourceUrl;
      if(!publicUrl(officialUrl))continue;
      items.push({id:contentHash(brand.id+'|'+canonical+'|'+key).slice(0,20),brandId:brand.id,kind:c.kind,title,
        officialUrl,sourceUrl:canonical,sourceHash,checkedAt,evidenceText:evidence,evidenceHash:contentHash(evidence),
        price,context,comparisonKey:(c.comparisonGroup||canonical)+'|'+JSON.stringify(context),comparisonEvidence,
        conditions:[...conditionEvidence(evidence.split('公式HTML画像 ')[0]),c.conditions].filter(Boolean),targetCourses:c.courses||[],exclusive:!!c.exclusive,
        scopeLabel:c.exclusive?'対象コース限定の注目メニュー':c.kind==='highlight'?'公式の注目メニュー':null,
        imageUrl:c.image?.imageUrl||null,width:null,height:null,rank:c.rank??rank,
        campaignId:campaign?.id||null,parentHash:campaign?.contentHash||null,verificationState:'confirmed',planExistence:c.planExistence||'confirmed'});
    }
    return{items:dedupCatalog(items),source:{sourceUrl:canonical,sourceHash,checkedAt,status:'ok',entries:items.length}};
  }
  function add(rawTitle,node,image=null,explicitKind=null){
    if(excluded(node,root))return;
    const evidence=clean(text(node));
    let title=shortTitle(rawTitle);
    if(title.length<3||title.length>130||NOISE.test(title)||/終了しました|販売終了|提供終了|販売中止/.test(evidence))return;
    if(!campaign&&/期間限定|フェア|キャンペーン|\d{1,2}月\d{1,2}日/.test(title))return;
    if(!campaign&&/期間限定|季節限定/.test(evidence))return;
    const kind=explicitKind||kindFor(title,evidence,{isMenuPage,hasImage:!!image});
    if(!kind)return;
    if(kind==='highlight'&&/コース|料金|食べ放題/.test(title)&&title.length>60)return;
    const href=[node,...ancestors(node,root)].find(n=>n.tag==='a'&&n.attrs.href)?.attrs.href;
    let officialUrl=href?(publicUrl(href,sourceUrl)||sourceUrl):sourceUrl;
    // Never route a menu tile to an unrelated external page discovered in markup.
    if(new URL(officialUrl).origin!==new URL(sourceUrl).origin)officialUrl=sourceUrl;
    const p=priceEvidence(kind==='drink'&&/延長|付き|学生|高校生/.test(evidence)?'':evidence);
    // Scope comparisons to this exact source and matching conditions, never
    // compare a national 'from' price with a specific local shop's rate.
    const context=comparisonContext(evidence,kind);
    const key=kind+'|'+title+'|'+(p.amount??'')+'|'+JSON.stringify(context);
    if(seen.has(key))return;seen.add(key);
    const courses=targetCourses(evidence),explicitExclusive=kind==='highlight'&&courses.length>0&&/(?:コース(?:でのみ|のみ|限定)|(?:限定|のみ)[^。]{0,18}コース)/.test(evidence);
    items.push({
      id:contentHash(brand.id+'|'+canonical+'|'+key).slice(0,20),brandId:brand.id,kind,title,
      officialUrl,sourceUrl:canonical,sourceHash,checkedAt,evidenceText:evidence,evidenceHash:contentHash(evidence),
      price:p,context,comparisonKey:canonical+'|'+JSON.stringify(context),conditions:conditionEvidence(evidence),
      targetCourses:courses,exclusive:explicitExclusive,scopeLabel:explicitExclusive?'上位・限定コースの注目メニュー':kind==='highlight'?'公式の注目メニュー':null,
      imageUrl:image?.imageUrl||null,width:null,height:null,
      campaignId:campaign?.id||null,parentHash:campaign?.contentHash||null,
      verificationState:'confirmed'
    });
  }
  // Price rows are kept local to their course. A page-wide set of prices is
  // deliberately not assigned to the first dish on the page.
  for(const n of all(root,'h1,h2,h3,h4,dt,tr')){
    const title=text(n.tag==='tr'?(one(n,'th')||one(n,'td')||n):n);
    if(!COURSE.test(title)&&!DRINK.test(title)&&!PREMIUM.test(title))continue;
    const context=n.tag==='tr'?n:contextFor(n,root);
    const photo=photoNodes(context,sourceUrl).find(p=>p.title&&clean(title).includes(shortTitle(p.title)))||photoNodes(context,sourceUrl)[0]||null;
    add(title,context,photo);
  }
  for(const image of photoNodes(root,sourceUrl)){
    if(excluded(image.node,root))continue;
    const context=contextFor(image.node,root);
    const nearby=one(context,'h1,h2,h3,h4,dt,.title,.name');
    const title=image.title||text(nearby)||text(context);
    if(!title||title.length>300)continue;
    add(title,context,image);
  }
  // Image-only course menus can be linked by an explicit textual course name.
  for(const l of links(root,sourceUrl)){
    if(excluded(l.node,root)||l.title.length>160)continue;
    if(!COURSE.test(l.title)&&!DRINK.test(l.title))continue;
    const image=photoNodes(l.node,sourceUrl)[0]||null;
    if(!image&&! /[¥￥円]|飲み放題|ドリンクバー/.test(l.title))continue;
    add(l.title,l.node,image);
  }
  // The explicit existence of a drink plan is useful even when its price is
  // image-only or store-dependent. Never infer all-you-can-drink from /drink/.
  if(!items.some(x=>x.kind==='drink')&&DRINK.test(body)){
    const n=all(root,'p,li,dt,dd,a').find(n=>DRINK.test(text(n))&&text(n).length<450&&!excluded(n,root));
    if(n){const m=text(n).match(/(?:アルコール|ソフトドリンク|プレミアム|スタンダード)?(?:飲み放題|ドリンクバー|フリードリンク)/);if(m)add(m[0],n,photoNodes(n,sourceUrl)[0]||null,'drink');}
  }
  return {items:dedupCatalog(items),source:{sourceUrl:canonical,sourceHash,checkedAt,status:'ok',entries:items.length}};
}
function ancestors(node,root){const out=[];for(let n=node.parent;n&&n!==root;n=n.parent)out.push(n);return out;}
export function dedupCatalog(items){
  const map=new Map();
  for(const i of items){
    const title=i.title.replace(/\s+/g,'');
    const key=[i.brandId,i.kind,title,i.context?.subBrand||'',i.kind==='highlight'?'dish':i.context?.scope||i.sourceUrl,i.campaignId||''].join('|');
    const old=map.get(key);
    const score=x=>(Number.isFinite(x.price?.amount)?8:0)+(x.imageUrl?4:0)+(x.exclusive?3:0)+(x.targetCourses?.length?2:0)-x.evidenceText.length/10000;
    if(!old){map.set(key,i);continue;}
    const best=score(i)>score(old)?i:old,other=best===i?old:i;
    // Photo and price may be combined only when their source page is identical.
    map.set(key,best.sourceUrl===other.sourceUrl&&!best.imageUrl&&other.imageUrl?{...best,imageUrl:other.imageUrl,width:other.width,height:other.height}:best);
  }
  const rows=[...map.values()];
  const used=new Set();return rows.map(i=>{
    const key=i.imageUrl&&imageKey(i.imageUrl);
    if(key&&used.has(key))return {...i,imageUrl:null,width:null,height:null};
    if(key)used.add(key);return i;
  });
}
export function discoverCatalogLinks(html,base,brand){
  const allowed=new URL(brand.homeUrl),root=parseHtml(html);
  return links(root,base).filter(l=>{
    if(!l.node.attrs.href)return false;
    const u=publicUrl(l.url);if(!u)return false;const t=new URL(u);
    if(t.origin!==allowed.origin)return false;
    // A corporate host may contain several unrelated brands.
    if(allowed.pathname!=='/'&&!t.pathname.startsWith(allowed.pathname))return false;
    if(/\.(?:jpe?g|png|gif|webp|svg|avif|zip|exe|pdf)(?:$|\?)/i.test(t.pathname)||/\/news\/|\/topics?\/|\/20\d{2}\//.test(t.pathname))return false;
    if(NOISE.test(l.title)||/学生|学割|お子様|キッズ|予約する/.test(l.title))return false;
    return (/shop-list|shoplist/.test(new URL(base).pathname)&&/豊橋|豊川|蒲郡|岡崎|浜松/.test(l.title))||/menu|course|price|drink|lunch|dinner|enkai|buffet|tabehodai|tabehoudai|nomihodai|plan|all-you-can-eat|\/(?:qa|about)\//i.test(t.pathname+t.search)||COURSE.test(l.title)||DRINK.test(l.title);
  }).map(l=>({url:l.url,title:l.title,rank:DRINK.test(l.title)||/drink|nomihodai/.test(l.url)?0:/コース|食べ放題|料金|price|course/.test(l.title+l.url)?1:2})).sort((a,b)=>a.rank-b.rank);
}
