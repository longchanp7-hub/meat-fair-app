// UI policy extracted from the 2026-09-15 chain-by-chain review.
// Data collection stays factual; this file controls only what is emphasized.
export const EXCLUDED_BRANDS=new Set(['kushiya-monogatari']);

const BASE={
  showHighlights:false,
  coursePhotos:false,
  drinkPhotos:false,
  hideTextWhenPhoto:true,
  compactText:true,
  fairGallery:'campaigns',
  courseAllow:null,
  courseDeny:null,
  drinkAllow:null,
  drinkDeny:null,
  auxCourseAllow:null,
  note:null
};

export const BRAND_PRESENTATION={
  'yakiniku-king':{
    ...BASE,coursePhotos:true,
    courseAllow:/58品|きんぐコース|プレミアムコース|ランチ食べ放題/i,
    drinkAllow:/ソフトドリンク\s*飲み放題|ソフトドリンク\s*\+\s*アルコール\s*飲み放題/i,
    note:'フェア→写真付き3コース→小さなランチ→2種類の飲み放題'
  },
  gyukaku:{
    ...BASE,coursePhotos:true,
    drinkAllow:/ソフト.*飲み放題|アルコール.*飲み放題|飲み放題.*アルコール/i,
    note:'フェア→主要コース→飲み放題'
  },
  syabuyo:{
    ...BASE,fairGallery:'syabuyo',
    courseAllow:/黒毛和牛|牛豚|豚2種|豚肉2皿|60分|平日.*ランチ|平日.*ディナー|しゃぶしゃぶ寿司/i,
    note:'鴨フェア＋九州黒豚／黒毛和牛を上部、料金は小さいパネルで安い順'
  },
  yuzuan:{
    ...BASE,coursePhotos:true,drinkPhotos:true,
    courseAllow:/ランチ|お手軽|ゆず庵コース|贅沢/i,
    note:'写真付きの通常コース4系統だけを中心に表示'
  },
  'washoku-sato':{
    ...BASE,
    courseAllow:/さとしゃぶ|さとすき|さと式?焼肉/i,
    courseDeny:/宴席|ランチメニュー|通常メニュー|さとカフェ|さとバル/i,
    drinkAllow:/飲み放題|さとバル|さとカフェ|アルコール/i,
    note:'さとしゃぶ／さとすき／さと式焼肉を分けて料金表示。宴席・通常メニュー写真は非表示'
  },
  amiyakitei:{
    ...BASE,fairGallery:'amiyakitei',coursePhotos:true,hideTextWhenPhoto:false,
    drinkAllow:/飲み放題/i,
    note:'厚切りフェスと小写真は維持。料金テキストは座布団状に圧縮'
  },
  onyasai:{
    ...BASE,
    courseAllow:/コース/i,
    drinkAllow:/飲み放題|ドリンク/i,
    note:'個別料理・注目メニューは出さずコースと料金中心'
  },
  roan:{
    ...BASE,
    courseAllow:/ビュッフェ|しゃぶ|麻辣湯|海鮮/i,
    drinkAllow:/飲み放題|ドリンクバー/i,
    note:'現在のシンプルさを維持'
  },
  'kalubi-taisho':{
    ...BASE,
    courseAllow:/コース/i,
    courseDeny:/全メニュー|メニュー一覧/i,
    drinkAllow:/飲み放題/i,
    note:'全メニュー画像は出さずコース料金と飲み放題の有無・金額'
  },
  'stamina-taro':{
    ...BASE,
    courseAllow:/ランチ|ディナー|食べ放題|コース/i,
    drinkAllow:/飲み放題|ドリンク/i,
    note:'コース・ディナー・飲み放題のシンプル構成'
  },
  asakuma:{
    ...BASE,
    courseAllow:/サラダバー/i,
    courseDeny:/アボカド|カレー|スープ|通常コース/i,
    drinkAllow:/飲み放題/i,
    note:'上部フェア3枚を主役にし、下はサラダバー情報だけ'
  },
  'nikusho-sakai':{
    ...BASE,coursePhotos:true,drinkPhotos:true,
    courseAllow:/コース/i,
    drinkAllow:/飲み放題|ドリンク/i,
    note:'基準レイアウト。フェア→写真付きコースを安い順→写真付き飲み放題'
  },
  'jukusei-ichiban':{
    ...BASE,coursePhotos:true,drinkPhotos:true,
    courseAllow:/ライト|いちばん食べ放題|牛タン|黒毛和牛|コース/i,
    drinkAllow:/飲み放題|ドリンクバー/i,
    note:'写真付きコースだけを主表示し、重複テキストは出さない'
  },
  anrakutei:{
    ...BASE,coursePhotos:true,drinkPhotos:true,
    courseAllow:/コース/i,
    drinkAllow:/飲み放題|ドリンク/i,
    note:'写真付きパネルを優先し下の重複テキストは出さない'
  }
};

export function presentationFor(brandId){return BRAND_PRESENTATION[brandId]||BASE;}
export function visibleBrand(brandId){return !EXCLUDED_BRANDS.has(brandId);}
export function matchesRule(value,allow,deny){
  const text=String(value||'');
  if(deny&&deny.test(text))return false;
  return !allow||allow.test(text);
}

export function fairAssetVisible(brandId,asset){
  // Tests and future chains without an explicit presentation policy retain the
  // generic verified gallery behavior. The 14 reviewed chains below are the
  // only ones intentionally trimmed for the compact Sakai-style UI.
  if(!BRAND_PRESENTATION[brandId])return true;
  const p=presentationFor(brandId);
  if(asset.kind==='campaign')return true;
  if(p.fairGallery==='amiyakitei')return asset.kind==='detail'&&asset.group!=='drink';
  if(p.fairGallery==='syabuyo')return asset.kind==='detail'&&asset.group==='course'&&/九州黒豚|黒毛和牛/.test(asset.title||'');
  return false;
}

export function catalogEntryVisible(brandId,entry){
  if(!BRAND_PRESENTATION[brandId])return entry.kind!=='highlight'||true;
  const p=presentationFor(brandId);
  if(entry.kind==='highlight')return p.showHighlights===true;
  if(entry.kind==='course')return matchesRule(entry.title,p.courseAllow,p.courseDeny);
  if(entry.kind==='drink')return matchesRule(entry.title,p.drinkAllow,p.drinkDeny);
  return false;
}
