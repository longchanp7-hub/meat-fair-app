// Supplemental official URLs are retained from the concurrent rollout.
// Factual overrides live only in reviewed-campaigns.json with a content-hash guard.
export const SOURCES = [
  { brandId:'yakiniku-king', name:'焼肉きんぐ', category:'yakiniku', priority:1, sources:[
    { type:'news_index', url:'https://www.yakiniku-king.jp/news/', primary:true },
    { type:'seasonal_index', url:'https://www.yakiniku-king.jp/menu_all/season', primary:true }
  ]},
  { brandId:'gyukaku', name:'牛角', category:'yakiniku', priority:2, sources:[
    { type:'brand_top', url:'https://www.gyukaku.ne.jp/', primary:true },
    { type:'news_index', url:'https://www.gyukaku.ne.jp/news/', primary:false }
  ]},
  { brandId:'syabuyo', name:'しゃぶ葉', category:'shabu', priority:3, sources:[
    { type:'brand_top', url:'https://www.skylark.co.jp/syabuyo/', primary:true }
  ]},
  { brandId:'yuzuan', name:'ゆず庵', category:'shabu', priority:4, sources:[
    { type:'news_index', url:'https://www.shabu-yuzuan.jp/news/', primary:true }
  ]},
  { brandId:'washoku-sato', name:'和食さと', category:'shabu', priority:5, sources:[
    { type:'brand_news', url:'https://sato-res.com/news/brand/sato/', primary:true },
    { type:'brand_top', url:'https://sato-res.com/sato/', primary:false }
  ]},
  { brandId:'amiyakitei', name:'あみやき亭／あみやき亭Plus', category:'yakiniku', priority:6, sources:[
    { type:'brand_top', url:'https://amiyakitei.jp/', primary:true },
    { type:'topics_index', url:'https://amiyakitei.jp/topics/', primary:false }
  ]},
  { brandId:'onyasai', name:'しゃぶしゃぶ温野菜', category:'shabu', priority:7, sources:[
    { type:'brand_top', url:'https://www.onyasai.com/', primary:true },
    { type:'news_index', url:'https://www.onyasai.com/news/index.php?year=2026', primary:false },
    { type:'campaign_detail', url:'https://www.onyasai.com/lp/202607_korea/', campaignTitle:'夏のごちそう韓国鍋 海鮮チゲ鍋・コムタン鍋', primary:false },
    { type:'campaign_detail', url:'https://www.onyasai.com/lp/202609_kamoshabu_porcini/', campaignTitle:'秋しゃぶ 豆乳ポルチーニしゃぶしゃぶ・鴨しゃぶ', primary:false }
  ]},
  { brandId:'roan', name:'露菴', category:'buffet', priority:8, sources:[
    { type:'official_blog', url:'https://ameblo.jp/0141roan/entrylist.html', primary:true },
    { type:'campaign_detail', url:'https://ameblo.jp/0141roan/entry-12970963402.html', campaignTitle:'麻辣湯食べ放題 全時間帯で提供中！', primary:false },
    { type:'campaign_detail', url:'https://ameblo.jp/0141roan/entry-12953365343.html', campaignTitle:'大赤海老も！大ホタテも食べ放題！第2弾！極み大海鮮フェア開催！！', primary:false },
    { type:'brand_top', url:'https://www.good-promise.co.jp/roan/', primary:false },
    { type:'reference_detail', url:'https://www.good-promise.co.jp/roan/price02/', primary:false }
  ]},
  { brandId:'kalubi-taisho', name:'カルビ大将', category:'yakiniku', priority:9, sources:[
    { type:'campaign_index', url:'https://www.kalubi-taisho.com/campaign/', primary:true },
    { type:'reference_detail', url:'https://www.kalubi-taisho.com/campaign/4605/', primary:false }
  ]},
  { brandId:'stamina-taro', name:'すたみな太郎', category:'buffet', priority:10, sources:[
    { type:'brand_top', url:'https://staminataro.jp/', primary:true },
    { type:'year_index', url:'https://staminataro.jp/2026/', primary:false },
    { type:'reference_detail', url:'https://staminataro.jp/2026/09/10/ninnikufair20260918/', primary:false }
  ]},
  { brandId:'asakuma', name:'ステーキのあさくま', category:'steak', priority:11, sources:[
    { type:'brand_top', url:'https://www.asakuma.co.jp/', primary:true },
    { type:'reference_detail', url:'https://www.asakuma.co.jp/fair_house-steak.html', primary:false }
  ]},
  { brandId:'nikusho-sakai', name:'肉匠坂井', category:'yakiniku', priority:12, sources:[
    { type:'news_index', url:'https://www.yakiniku.jp/nikushou_sakai/news/', primary:true },
    { type:'brand_top', url:'https://www.yakiniku.jp/nikushou_sakai/', primary:false }
  ]},
  { brandId:'jukusei-ichiban', name:'熟成焼肉いちばん', category:'yakiniku', priority:13, sources:[
    { type:'current_menu', url:'https://www.jukusei-ichiban.jp/jp/menu/cat5.html', primary:true },
    { type:'news_index', url:'https://www.jukusei-ichiban.jp/jp/news/2026.html', primary:false }
  ]},
  { brandId:'anrakutei', name:'安楽亭', category:'yakiniku', priority:14, sources:[
    { type:'fair_index', url:'https://anrakutei.jp/fair/', primary:true },
    { type:'reference_detail', url:'https://anrakutei.jp/fair/290yenthanks/', primary:false }
  ]},
  { brandId:'kushiya-monogatari', name:'串家物語', category:'buffet', priority:15, sources:[
    { type:'brand_top', url:'https://www.kushi-ya.com/', primary:true },
    { type:'news_index', url:'https://www.kushi-ya.com/news/', primary:false },
    { type:'reference_detail', url:'https://www.kushi-ya.com/news/2026/09/post-136.html', primary:false }
  ]}
];

export const INCLUDE_KEYWORDS = [
  'フェア','フェス','期間限定','食べ放題','限定','キャンペーン','新メニュー','コラボ','半額','OFF','割引','お値打ち','ナイト割','牛たん','牛タン','黒毛和牛','かに','カニ','蟹','海鮮','韓国','台湾','北海道','九州','デザート','飲み放題','価格改定','感謝祭','ニンニク','ポルチーニ','鴨しゃぶ'
];

export const EXCLUDE_KEYWORDS = [
  '採用','求人','IR','募金','CM公開','店舗オープン','営業時間変更','設備工事'
];
