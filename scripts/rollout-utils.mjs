import { absolute, canonicalUrl } from './fair-utils.mjs';

export const NEXT_ROLLOUT_IDS=['washoku-sato','amiyakitei','onyasai','nikusho-sakai'];

const EXCLUDE={
  'washoku-sato':/(?:テイクアウト|お持ち帰り|d払い|PayPay|映画|プリキュア|アプリプレゼント|キッズ|おこさま|改装|オープン|休業|営業時間|Xキャンペーン|フォロー|リポスト)/i,
  'amiyakitei':/(?:採用|求人|福袋|営業時間|忘新年会|学割|終了しました)/i,
  'onyasai':/(?:学生限定|学生グループ|イベントレポート|発表会|調査|コラボ|採用|求人)/i,
  'nikusho-sakai':/(?:学生応援|福袋|YouTube|アプリ|ドリンク飲み放題)/i
};

export function rolloutTitleRelevant(brandId,title=''){
  if(!NEXT_ROLLOUT_IDS.includes(brandId))return false;
  if(EXCLUDE[brandId]?.test(title))return false;
  if(brandId==='washoku-sato'&&!title.includes('和食さと'))return false;
  return /フェア|フェス|期間限定|食べ放題|半額|OFF|割引|お値打ち|ナイト割|松茸|サーモン|台湾|厚切り|敬老|秋しゃぶ|ポルチーニ|鴨しゃぶ|韓国鍋|海鮮チゲ|コムタン/.test(title);
}

export function rawRolloutUrls(brandId,html,base){
  const patterns={
    'washoku-sato':[/\/news\/20\d{2}\/\d{2}\/\d+\.html/g],
    'amiyakitei':[/\/atsugirifes(?:_no_coupon)?\//g,/\/topics\/\d+\//g],
    'onyasai':[/\/lp\/20\d{4}_[A-Za-z0-9_\-]+\//g],
    'nikusho-sakai':[/\/nikushou_sakai\/news\/(?!feed\/|page\/)[A-Za-z0-9_\-]+\//g]
  }[brandId]||[];
  const out=[];
  for(const re of patterns){for(const m of html.matchAll(re)){const url=canonicalUrl(absolute(base,m[0]));if(url)out.push({title:'',url})}}
  return out;
}

export function allowedRolloutPath(brandId,url){
  let u;try{u=new URL(url)}catch{return false}const p=u.pathname;
  if(brandId==='washoku-sato')return u.hostname==='sato-res.com'&&/^\/news\/20\d{2}\/\d{2}\/\d+\.html$/.test(p);
  if(brandId==='amiyakitei')return u.hostname==='amiyakitei.jp'&&(/^\/atsugirifes(?:_no_coupon)?\/$/.test(p)||/^\/topics\/\d+\/$/.test(p));
  if(brandId==='onyasai')return u.hostname==='www.onyasai.com'&&/^\/lp\/20\d{4}_[A-Za-z0-9_\-]+\/$/.test(p);
  if(brandId==='nikusho-sakai')return u.hostname==='www.yakiniku.jp'&&/^\/nikushou_sakai\/news\/[A-Za-z0-9_\-]+\/$/.test(p)&&!p.endsWith('/page/')&&!p.endsWith('/feed/');
  return false;
}

export function adjustRolloutFields(brandId,title,text,base){
  if(!NEXT_ROLLOUT_IDS.includes(brandId))return base;
  let {campaignType,priority}=base;
  const all=`${title} ${text}`;
  const major=/フェア|フェス|期間限定|秋しゃぶ|韓国鍋|ポルチーニ|鴨しゃぶ/.test(title);
  const ayce=/食べ放題/.test(title);
  const discount=/(?:\d+\s*%\s*OFF|半額|割引|お値打ち|ナイト割|お会計から\s*\d+\s*%)/i.test(all);
  if(major){campaignType='fair';priority='P1'}
  if(ayce){campaignType='all_you_can_eat';priority='P1'}
  if(!major&&!ayce&&discount){campaignType='discount';priority='P2'}
  if(/学生/.test(title))priority='P3';
  return {...base,campaignType,priority,allYouCanEat:base.allYouCanEat||/食べ放題/.test(all)};
}
