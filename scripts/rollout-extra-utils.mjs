import { absolute, canonicalUrl } from './fair-utils.mjs';

export const FINAL_ROLLOUT_IDS=['roan','kalubi-taisho','stamina-taro','asakuma','jukusei-ichiban','anrakutei','kushiya-monogatari'];

const EXCLUDE={
  roan:/(?:LINE|求人|採用|営業時間|店休日|予約|店舗情報)/i,
  'kalubi-taisho':/(?:閉店|オープン|採用|求人|TVCM|ポイント3倍|学生食べ放題|スポーツ応援|アプリポイント|食中毒)/i,
  'stamina-taro':/(?:貸し切り|貸切|営業時間|休業|閉店|採用|求人|新店)/i,
  asakuma:/(?:採用|求人|店舗情報|営業時間|閉店|終了しました)/i,
  'jukusei-ichiban':/(?:学生専用|学生グループ|営業時間|閉店|設備工事|店内清掃|募金|アプリ|ランチメニューをお休み|機器入替)/i,
  anrakutei:/(?:採用|求人|店舗オープン|営業時間|終了)/i,
  'kushiya-monogatari':/(?:偽アカウント|注意|採用|求人|営業時間|閉店)/i
};

export function extraTitleRelevant(brandId,title=''){
  if(!FINAL_ROLLOUT_IDS.includes(brandId)||EXCLUDE[brandId]?.test(title))return false;
  if(/フェア|フェス|期間限定|食べ放題|半額|OFF|割引|感謝祭|ニンニク|キャンペーン|ハッピーアワー/.test(title))return true;
  if(brandId==='roan')return /大海鮮|ホタテ|赤海老|かに|カニ|蟹/.test(title);
  if(brandId==='kalubi-taisho')return /メキシカン/.test(title);
  if(brandId==='stamina-taro')return /韓国|ガーリック|厚切り/.test(title);
  if(brandId==='asakuma')return /ハウスステーキ|ステーキ/.test(title)&&/限定|フェア/.test(title);
  if(brandId==='jukusei-ichiban')return /焼肉フェア|北海道|バーベキュー|カニ/.test(title);
  if(brandId==='anrakutei')return /肉の日|クーポン|冷麺|コスパ宣言/.test(title);
  if(brandId==='kushiya-monogatari')return /串の日|韓国|抹茶|いちご|バレンタイン/.test(title);
  return false;
}

export function rawExtraUrls(brandId,html,base){
  const patterns={
    roan:[/\/roan\/price\d+\//g],
    'kalubi-taisho':[/\/campaign\/\d+\//g],
    'stamina-taro':[/\/20\d{2}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]+\//g],
    asakuma:[/\/fair[^"'<> ]*\.html/g],
    'jukusei-ichiban':[/\/jp\/news\/detail\/[A-Za-z0-9_-]+\.html/g,/\/jp\/menu\/cat5\.html/g],
    anrakutei:[/\/fair\/[A-Za-z0-9_-]+\//g],
    'kushiya-monogatari':[/\/news\/20\d{2}\/\d{2}\/[A-Za-z0-9_-]+\.html/g]
  }[brandId]||[];
  const out=[];
  for(const re of patterns)for(const m of html.matchAll(re)){const url=canonicalUrl(absolute(base,m[0]));if(url)out.push({title:'',url})}
  return out;
}

export function allowedExtraPath(brandId,url){
  let u;try{u=new URL(url)}catch{return false}const p=u.pathname;
  if(brandId==='roan')return u.hostname==='www.good-promise.co.jp'&&/^\/roan\/price\d+\/$/.test(p);
  if(brandId==='kalubi-taisho')return u.hostname==='www.kalubi-taisho.com'&&/^\/campaign\/\d+\/$/.test(p);
  if(brandId==='stamina-taro')return u.hostname==='staminataro.jp'&&/^\/20\d{2}\/\d{2}\/\d{2}\/[A-Za-z0-9_-]+\/$/.test(p);
  if(brandId==='asakuma')return u.hostname==='www.asakuma.co.jp'&&/^\/fair[^/]*\.html$/.test(p);
  if(brandId==='jukusei-ichiban')return u.hostname==='www.jukusei-ichiban.jp'&&(/^\/jp\/news\/detail\/[A-Za-z0-9_-]+\.html$/.test(p)||p==='/jp/menu/cat5.html');
  if(brandId==='anrakutei')return u.hostname==='anrakutei.jp'&&/^\/fair\/[A-Za-z0-9_-]+\/$/.test(p);
  if(brandId==='kushiya-monogatari')return u.hostname==='www.kushi-ya.com'&&/^\/news\/20\d{2}\/\d{2}\/[A-Za-z0-9_-]+\.html$/.test(p);
  return false;
}

export function adjustExtraFields(brandId,title,text,base){
  if(!FINAL_ROLLOUT_IDS.includes(brandId))return base;
  let {campaignType,priority}=base;
  const all=`${title} ${text}`;
  const themed=/フェア|フェス|ニンニク|メキシカン|大海鮮|ハウスステーキ|焼肉フェア/.test(title);
  const ayce=/食べ放題/.test(title);
  const discount=/(?:\d+\s*%\s*OFF|\d+\s*％\s*引|半額|割引|クーポン感謝祭|ハッピーアワー)/i.test(all);
  if(themed){campaignType='fair';priority='P1'}
  if(ayce){campaignType='all_you_can_eat';priority='P1'}
  if(!themed&&!ayce&&discount){campaignType='discount';priority='P2'}
  if(brandId==='anrakutei'&&/クーポン感謝祭/.test(title)){campaignType='discount';priority='P2'}
  if(brandId==='kushiya-monogatari'&&/串の日キャンペーン/.test(title)){campaignType='discount';priority='P2'}
  return {...base,campaignType,priority,allYouCanEat:base.allYouCanEat||/食べ放題/.test(all)};
}
