export const SOURCES = [
  { brandId:'yakiniku-king', name:'焼肉きんぐ', category:'yakiniku', priority:1, sources:[
    { type:'news_index', url:'https://www.yakiniku-king.jp/news/', primary:true }
  ]},
  { brandId:'gyukaku', name:'牛角', category:'yakiniku', priority:2, sources:[
    { type:'news_index', url:'https://www.gyukaku.ne.jp/news/', primary:true }
  ]},
  { brandId:'syabuyo', name:'しゃぶ葉', category:'shabu', priority:3, sources:[
    { type:'brand_top', url:'https://www.skylark.co.jp/syabuyo/', primary:true }
  ]},
  { brandId:'yuzuan', name:'ゆず庵', category:'shabu', priority:4, sources:[
    { type:'news_index', url:'https://www.shabu-yuzuan.jp/news/', primary:true }
  ]},
  { brandId:'washoku-sato', name:'和食さと', category:'shabu', priority:5, sources:[
    { type:'brand_top', url:'https://sato-res.com/sato/', primary:true }
  ]},
  { brandId:'amiyakitei', name:'あみやき亭／あみやき亭Plus', category:'yakiniku', priority:6, sources:[
    { type:'brand_top', url:'https://amiyakitei.jp/', primary:true }
  ]},
  { brandId:'onyasai', name:'しゃぶしゃぶ温野菜', category:'shabu', priority:7, sources:[
    { type:'brand_top', url:'https://www.onyasai.com/', primary:true }
  ]},
  { brandId:'roan', name:'露菴', category:'buffet', priority:8, sources:[
    { type:'brand_top', url:'https://www.good-promise.co.jp/roan/', primary:true }
  ]},
  { brandId:'kalubi-taisho', name:'カルビ大将', category:'yakiniku', priority:9, sources:[
    { type:'campaign_index', url:'https://www.kalubi-taisho.com/campaign/', primary:true }
  ]},
  { brandId:'stamina-taro', name:'すたみな太郎', category:'buffet', priority:10, sources:[
    { type:'brand_top', url:'https://staminataro.jp/', primary:true }
  ]},
  { brandId:'asakuma', name:'ステーキのあさくま', category:'steak', priority:11, sources:[
    { type:'brand_top', url:'https://www.asakuma.co.jp/', primary:true }
  ]},
  { brandId:'nikusho-sakai', name:'肉匠坂井', category:'yakiniku', priority:12, sources:[
    { type:'brand_top', url:'https://www.yakiniku.jp/nikushou_sakai/', primary:true }
  ]},
  { brandId:'jukusei-ichiban', name:'熟成焼肉いちばん', category:'yakiniku', priority:13, sources:[
    { type:'news_index', url:'https://www.jukusei-ichiban.jp/jp/news/', primary:true }
  ]},
  { brandId:'anrakutei', name:'安楽亭', category:'yakiniku', priority:14, sources:[
    { type:'fair_index', url:'https://anrakutei.jp/fair/', primary:true }
  ]},
  { brandId:'kushiya-monogatari', name:'串家物語', category:'buffet', priority:15, sources:[
    { type:'brand_top', url:'https://www.kushi-ya.com/', primary:true }
  ]}
];

export const INCLUDE_KEYWORDS = [
  'フェア','期間限定','食べ放題','限定','キャンペーン','新メニュー','コラボ','半額','OFF','牛たん','牛タン','黒毛和牛','かに','カニ','蟹','海鮮','韓国','台湾','北海道','九州','デザート','飲み放題','価格改定'
];

export const EXCLUDE_KEYWORDS = [
  '採用','求人','IR','募金','CM公開','店舗オープン','営業時間変更','設備工事'
];
