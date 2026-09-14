import crypto from 'node:crypto';
import {parseHtml,one,all,text,markup,links,httpUrl} from './html-document.mjs';
import {imageCandidatesFromHtml} from './fair-utils.mjs';

export const PROFILE = {
  'yakiniku-king':{scope:'main,article',head:'h1',paths:/^\/(?:news\/\d+\/?|menu_all\/season\/[^/]+\/?)$/},
  gyukaku:{scope:'#contents,main,article',head:'h1',paths:/^\/lp\/.+|^\/news\/news\.php$/},
  syabuyo:{scope:'.area-contents',head:'h1.mod-heading',paths:/^\/syabuyo\/(?:menu\/fair[^/]*\/|campaign\/.+)/},
  yuzuan:{scope:'main',head:'h1',paths:/^\/news\/\d+\/$/},
  'washoku-sato':{scope:'article.news',head:'h3',paths:/^\/news\/20\d{2}\/\d{2}\/\d+\.html$/},
  amiyakitei:{scope:'main,.page_container_single',head:'h1.header-title,.page_container_single_title,h2',paths:/^\/atsugirifes(?:_no_coupon)?\/$|^\/topics\/\d+\/$/},
  onyasai:{scope:'main,#contents,.contents',head:'h1',paths:/^\/lp\/20\d{4}_[^/]+\/$/},
  roan:{scope:'article,main',head:'h1,h2',paths:/\/roan\/(?:news|fair|campaign)\/[^/]+\/?$|^\/0141roan\/entry-\d+\.html$/},
  'kalubi-taisho':{scope:'.detail',head:'h3.detail_title',paths:/^\/campaign\/\d+\/$/},
  'stamina-taro':{scope:'main',head:'h1.wp-block-post-title',paths:/^\/20\d{2}\/\d{2}\/\d{2}\/[^/]+\/$/},
  asakuma:{scope:'#main',head:'h1.heading',paths:/^\/(?:fair_|event_)[\w-]+\.html$/},
  'nikusho-sakai':{scope:'.p-entry',head:'h1.p-entry__title',paths:/^\/nikushou_sakai\/news\/(?!feed\/|page\/)[\w-]+\/$/},
  'jukusei-ichiban':{scope:'.menuFair_wrap,main',head:'h3,h2',paths:/^\/jp\/menu\/cat5\.html$|^\/jp\/news\/20\d{2}\/.+\.html$/},
  anrakutei:{scope:'article#contentsArea',head:'h3',paths:/^\/(?:fair|topic)\/[^/]+\/$/},
  'kushiya-monogatari':{scope:'.newsbox',head:'h2',paths:/^\/news\/20\d{2}\/\d{2}\/[^/]+\.html$/}
};
export const FOOD_TITLE=/フェア|フェス|期間限定|季節|食べ放題|半額|割引|OFF|お値打ち|ナイト割|厚切り|秋しゃぶ|感謝祭|肉祭|牛タン|牛たん|鴨しゃぶ|ポルチーニ|コムタン|海鮮チゲ|串の日|特選ジャンボ|ニンニク|麻辣湯|マーラータン|大海鮮/i;
export const NON_FOOD=/アンケート|Q\d|食育|啓発|採用|求人|抽選|スピードくじ|山分け|プレゼント|フォロー|リポスト|SNS|グッズ|福袋|テイクアウト|持ち帰り|d払い|PayPay|映画|プリキュア|学生専用|学生限定|学生応援|学割|キッズ|改装|オープン|休業|営業時間|価格改定|ドリンク飲み放題|飲み放題のみ/i;
export const ENDED=/【終了|※\s*終了|終了しました|終了いたしました|販売を終了|販売終了いたしました|キャンペーンは終了/;
export function allowedDetail(brand,url){const u=new URL(url);const hosts=new Set(brand.sources.map(s=>new URL(s.url).hostname));return hosts.has(u.hostname)&&PROFILE[brand.brandId]?.paths.test(u.pathname)&&!/[.](pdf|jpg|png|webp|css|js)$/i.test(u.pathname);}
function meta(doc,key){return all(doc,'meta').find(n=>n.attrs.property===key||n.attrs.name===key)?.attrs.content||'';}
export function extractPage(brand,html,url,anchor=''){
  const doc=parseHtml(html),profile=PROFILE[brand.brandId]||{};
  let scope=one(doc,profile.scope||'main,article')||one(doc,'body')||doc;
  // Never include the Sakai sidebar / neighboring posts or the Sato logo article.
  let body=brand.brandId==='nikusho-sakai'?(one(doc,'.p-entry__body')||scope):scope;
  if(brand.brandId==='kushiya-monogatari')body=one(scope,'.contents')||scope;
  if(brand.brandId==='jukusei-ichiban'){scope=one(scope,'dl')||scope;body=scope;}
  const heading=one(scope,profile.head||'h1');
  const possibilities=[text(heading),meta(doc,'og:title'),text(one(doc,'title')),anchor];
  let title=possibilities.find(t=>t&&FOOD_TITLE.test(t)&&!/^メニュー|^お知らせ|^【公式】/.test(t))||anchor||possibilities.find(Boolean)||'';
  if(brand.brandId==='onyasai'&&anchor&&FOOD_TITLE.test(anchor))title=anchor;
  if(brand.brandId==='amiyakitei'&&url.includes('atsugirifes'))title='厚切りフェス';
  title=title.replace(/\s*[|｜].*$/,'').replace(/^20\d{2}[./-]\d{1,2}[./-]\d{1,2}\s*/,'').replace(/焼肉きんぐ\s*/g,'').trim();
  title=title.replace(/^(.{3,}?)\s+\1$/,'$1');
  let bodyText=text(body), scopedHtml=markup(body);
  if(brand.brandId==='syabuyo')bodyText=bodyText.split('ドリンクバー付！')[0];
  const time=all(scope,'time').find(n=>n.attrs.datetime)?.attrs.datetime;
  const dateNode=one(scope,'.detail_day,.date,.news_date,.p-entry__date,.wp-block-post-date')||one(doc,'.p-entry__date');
  const dateText=text(dateNode)||text(scope).slice(0,180);
  const m=dateText.match(/(20\d{2})[年./-]\s*(\d{1,2})[月./-]\s*(\d{1,2})/);
  let publishedDate=(time||meta(doc,'article:published_time')).slice(0,10)|| (m?iso(+m[1],+m[2],+m[3]):null);
  if(publishedDate&&!validDate(publishedDate))publishedDate=null;
  const actualImages=all(doc,'img,source').map(n=>httpUrl(n.attrs['data-src']||n.attrs.src||n.attrs.srcset?.split(/[ ,]/)[0],url)).filter(Boolean);
  return {title,bodyText,scopedHtml,doc,scope,publishedDate,actualImages,hash:crypto.createHash('sha256').update(bodyText+'\n'+all(body,'img,source').map(n=>n.attrs['data-src']||n.attrs.src||n.attrs.srcset||'').join('\n')).digest('hex')};
}
export function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
export function iso(y,m,d){const v=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return validDate(v)?v:null;}
export function parsePeriod(s,year){
  s=String(s).normalize('NFKC').replace(/\s+/g,'');
  // A full date or month/day. Year is never guessed from the runtime clock.
  const re=/(?:(20\d{2})[年/.-])?(\d{1,2})[月/](\d{1,2})日?(?:\([^)]{1,5}\))?/g;
  const ms=[...s.matchAll(re)];if(!ms.length)return null;
  const a=ms[0];const y=+(a[1]||year||0);if(!y)return null;
  const startDate=iso(y,+a[2],+a[3]);if(!startDate)return null;
  const tail=s.slice(a.index+a[0].length);let endDate=null;
  const second=ms[1];
  if(second&&/^(?:より|から)?[～〜~\-－—]/.test(tail)) {
    const between=s.slice(a.index+a[0].length,second.index);
    if(between.length<25)endDate=iso(+(second[1]||y+(+second[2]<+a[2]?1:0)),+second[2],+second[3]);
  }
  if(!endDate){const same=tail.match(/^(?:より|から)?[～〜~\-－—](\d{1,2})日/);if(same)endDate=iso(y,+a[2],+same[1]);}
  return{startDate,endDate,endDateText:/なくなり次第|無くなり次第/.test(s)?'なくなり次第終了':null};
}
export function datesFor(page,url){
  const urlYear=new URL(url).pathname.match(/\/(20\d{2})(?:\/|\d{2}_)/)?.[1];
  const year=+(urlYear||page.publishedDate?.slice(0,4)||0)||null;
  const t=page.bodyText;
  const labelled=t.match(/(?:販売期間|開催期間|実施期間|提供期間|キャンペーン期間|販売開始日)[:：\s】]*([\s\S]{0,180})/);
  const labelPeriod=labelled?parsePeriod(labelled[1],year):null;
  const titlePeriod=parsePeriod(page.title,year);
  // Explicit full-year period in LP text beats a publication date/anniversary in the title.
  const full=t.match(/20\d{2}年\s*\d{1,2}月\s*\d{1,2}日[^0-9]{0,18}[～〜~\-][\s\S]{0,45}/);
  const fullPeriod=full?parsePeriod(full[0],year):null;
  return labelPeriod||fullPeriod||titlePeriod||{startDate:null,endDate:null,endDateText:/なくなり次第終了|無くなり次第終了/.test(t)?'なくなり次第終了':null};
}
export function selectImage(page,url,title){
  const bad=/(?:logo|icon|btn_|button|qrcode|qr_|coupon|クーポン|title-|abstract-title|background|bg[_.-]|arrow|footer|header|app_|sign|ttl|term\.)/i;
  const candidates=imageCandidatesFromHtml(page.scopedHtml,url,{title}).filter(c=>/\.(?:jpe?g|png|webp)(?:\?|#|$)/i.test(c.url)&&!bad.test(c.url));
  const best=candidates.sort((a,b)=>b.score-a.score)[0];
  return best&&best.score>=10?httpUrl(best.url,url):null;
}
export function discoverLinks(brand,html,url){
  const doc=parseHtml(html);
  return links(doc,url).filter(x=>allowedDetail(brand,x.url)).map(x=>({url:x.url,title:x.title,sourceUrl:url}));
}
function topicKey(c){
  return c.title.normalize('NFKC')
    .replace(/20\d{2}年\d{1,2}月\d{1,2}日(?:\([^)]*\))?/g,'')
    .replace(/\d{1,2}月\d{1,2}日(?:\([^)]*\))?/g,'')
    .replace(/焼肉きんぐ|牛角|しゃぶ葉|ゆず庵|期間限定|フェア|フェス|キャンペーン|販売開始|発売開始|開催します|開催|お知らせ|より|から/g,'')
    .replace(/[\s「」『』【】!！?？。、・（）()~〜～\-]/g,'')
    .toLowerCase();
}
export function dedupCampaigns(rows){
  const out=[],keys=new Map();
  for(const c of rows){
    const title=c.title.normalize('NFKC').replace(/[\s「」『』【】!！。、]/g,'');
    const key=c.brandId+'|'+(c.campaignKey||c.officialUrl);
    const semantic=c.brandId+'|'+title+'|'+(c.startDate||'')+'|'+(c.endDate||'');
    const topic=topicKey(c);
    let at=keys.get(key)??keys.get(semantic);
    if(at===undefined&&topic.length>=5){
      at=out.findIndex(x=>{
        if(x.brandId!==c.brandId)return false;
        const other=topicKey(x);
        return other.length>=5&&(topic===other||topic.includes(other)||other.includes(topic));
      });
      if(at<0)at=undefined;
    }
    if(at===undefined){
      const idx=out.length;keys.set(key,idx);keys.set(semantic,idx);out.push({...c,secondarySources:c.secondarySources||[]});
    }else if(c.officialUrl!==out[at].officialUrl){
      out[at].secondarySources.push({url:c.officialUrl,title:c.title,type:c.sourceType});
    }
  }
  return out;
}
