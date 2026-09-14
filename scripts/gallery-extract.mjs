import {parseHtml,all,one,text,links,httpUrl} from './html-document.mjs';
import {officialPhotoCandidates} from './gallery-photo.mjs';
import {mediaSemantics} from '../app/gallery-semantics.mjs';
// Only actual image elements from an official page are eligible. No generated URLs.
const NONFOOD=/求人|採用|アンケート|ポイント|プレゼント|抽選|グッズ|学生|学割|キッズ|お子さま|お子様|ドリンクバー|アルコール|飲み放題のみ|アレルギー|原産地|栄養成分|料金表|価格表|お支払い|営業時間|店舗検索|壁紙|ダウンロード|QR|クーポン|スクリーンショット|有効期間|対象コースを|コース紹介|コース内容|詳しくはこちら|サワー|ハイボール|ビール|ワイン|茶ハイ|ウーロンハイ|焼酎|日本酒/i;
const DECORATION=/(?:logo|icon|qrcode|qr_|button|btn_|arrow|sprite|footer|header|bg[_.-]|spacer|loading)/i;
const FOOD=/食べ放題|ランチ|宴会|コース|フェア|豚|牛|鴨|鶏|ステーキ|ハンバーグ|ビュッフェ|しゃぶしゃぶ|カルビ|タン|ハラミ|ロース|ホルモン|焼肉|ロコモコ|シュリンプ|海鮮/;
export function publicUrl(raw,base){
  try{const u=new URL(raw,base);if(u.protocol!=='https:'||!u.hostname.includes('.')||/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname)||u.hostname.includes(':')||/\.(?:local|internal)$/.test(u.hostname)||u.username||u.password)return null;return u.href;}catch{return null;}
}
export function imageKey(raw){
  const u=new URL(raw);u.hash='';
  for(const k of ['width','height','w','h','quality','q'])u.searchParams.delete(k);
  return u.href.replace(/([_/-])(?:pc|sp|mobile|desktop)(?=[_./-])/gi,'$1device').replace(/-\d+x\d+(?=\.[a-z]+$)/i,'');
}
function candidates(node,base){
  const images=[];
  for(const img of all(node,'img')){
    const a=img.attrs,title=(a.alt||'').replace(/\s+/g,' ').trim();
    const raw=a['data-src']||a.src||a['data-original']||a.srcset?.split(/[ ,]/)[0];
    const imageUrl=publicUrl(raw,base);
    if(!imageUrl||!raw||! /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(imageUrl)||DECORATION.test(new URL(imageUrl).pathname))continue;
    if((a.width&&Number(a.width)<100)||(a.height&&Number(a.height)<65))continue;
    images.push({imageUrl,title,node:img});
  }
  return images;
}
function belongsToPage(node,scope,base){
  for(let n=node.parent;n&&n!==scope;n=n.parent){
    if(['header','footer','nav','aside'].includes(n.tag))return false;
    if(n.tag==='a'&&n.attrs?.href){
      const target=publicUrl(n.attrs.href,base);
      if(!target||httpUrl(target,base)!==httpUrl(base,base))return false;
    }
  }
  return true;
}
function uniqueVariants(items){
  const map=new Map();
  for(const item of items){const key=imageKey(item.imageUrl),old=map.get(key);if(!old||/([_/-])(sp|mobile)(?=[_./-])/i.test(item.imageUrl))map.set(key,item);}
  return [...map.values()];
}
export function detailAssets(scope,base,campaign){
  const mainKey=campaign.imageUrl?imageKey(campaign.imageUrl):null;
  const observed=uniqueVariants(candidates(scope,base)).filter(a=>belongsToPage(a.node,scope,base));
  return officialPhotoCandidates(observed).filter(a=>imageKey(a.imageUrl)!==mainKey&&a.title.length>=4&&a.title.length<=200&&FOOD.test(a.title)&&!NONFOOD.test(a.title)&&!/^コースは|^土[・日]|^おすすめ.*アレンジ|^ワクワク|^豪華.*コース/.test(a.title)).map(a=>{
    let href=base;
    for(let n=a.node.parent;n&&n!==scope;n=n.parent)if(n.attrs?.id){href=new URL('#'+n.attrs.id,base).href;break;}
    return mediaSemantics({imageUrl:a.imageUrl,title:a.title,officialUrl:href,sourceUrl:base,kind:'detail',rank:/食べ放題/.test(a.title)&&/[￥円]/.test(a.title)?20:30,campaignId:campaign.id,parentHash:campaign.contentHash});
  });
}
export function menuAssets(html,base,campaignUrls=[]){
  const doc=parseHtml(html),root=one(doc,'main,.area-contents,body')||doc,origin=new URL(base).origin;
  const campaignSet=new Set(campaignUrls.map(u=>httpUrl(u,base))),result=[];
  for(const link of links(root,base)){
    if(!link.node.attrs.href||link.node.attrs.href.startsWith('#'))continue;
    const target=publicUrl(link.url,base);if(!target||new URL(target).origin!==origin||campaignSet.has(httpUrl(target,base)))continue;
    if(/\/(?:news|topic|fair)(?:s)?\/|\/20\d{2}\//i.test(new URL(target).pathname))continue;
    if(/肉の日|感謝祭|\d{1,2}[月/]\d{1,2}[^。]{0,24}[～〜~－-]\s*\d{1,2}/.test(link.title))continue;
    if(/[都道府県]/.test(link.title)&&!/愛知|静岡/.test(link.title))continue;
    if(!/ランチ|宴会|食べ放題コース/.test(link.title)||/フェア|期間限定|終了しました|販売終了|販売中止/.test(link.title)||NONFOOD.test(link.title))continue;
    let banned=false;for(let n=link.node.parent;n&&n!==root;n=n.parent)if(['header','footer','nav','aside'].includes(n.tag))banned=true;
    if(banned)continue;
    for(const image of officialPhotoCandidates(uniqueVariants(candidates(link.node,base)))){
      const title=image.title||link.title;
      if(title.length<4||title.length>220||NONFOOD.test(title))continue;
      result.push({imageUrl:image.imageUrl,title,officialUrl:target,sourceUrl:base,kind:'menu',rank:/宴会/.test(title)?40:35});
    }
  }
  const byTarget=new Map();for(const a of result)if(!byTarget.has(a.officialUrl))byTarget.set(a.officialUrl,a);
  return [...byTarget.values()].map(mediaSemantics);
}
export function dimensions(b){
  // Honor the actual image signature, which may differ from the URL extension.
  if(b.length>=10&&/^GIF8[79]a$/.test(b.toString('ascii',0,6)))return{width:b.readUInt16LE(6),height:b.readUInt16LE(8)};
  if(b.length>=32&&b.toString('ascii',4,8)==='ftyp'&&/avif|avis|mif1/.test(b.toString('ascii',8,32))){
    const at=b.indexOf(Buffer.from('ispe'));
    if(at>=4&&at+16<=b.length&&b.readUInt32BE(at-4)>=20)return{width:b.readUInt32BE(at+8),height:b.readUInt32BE(at+12)};
  }
  if(b.length>=24&&b.toString('hex',0,8)==='89504e470d0a1a0a')return{width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  if(b.length>=30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
    const type=b.toString('ascii',12,16);
    if(type==='VP8X')return{width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
    if(type==='VP8 '&&b.length>=30)return{width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
    if(type==='VP8L'&&b.length>=25){const bits=b.readUInt32LE(21);return{width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};}
  }
  if(b.length>4&&b[0]===255&&b[1]===216){
    let i=2;while(i+4<b.length){if(b[i++]!==255)continue;while(b[i]===255)i++;const m=b[i++];if(m===217||m===218)break;if(m===1||m>=208&&m<=215)continue;const len=b.readUInt16BE(i);if(len<2||i+len>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m)&&len>=7)return{width:b.readUInt16BE(i+5),height:b.readUInt16BE(i+3)};i+=len;}
  }
  return null;
}
