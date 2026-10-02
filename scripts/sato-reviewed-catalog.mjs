import crypto from 'node:crypto';

const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function entry({title,kind='course',amount,text,sourceUrl,officialUrl=sourceUrl,checkedAt,evidence,service='ディナー',scope,imageUrl=null}){
  return {
    id:hash(['washoku-sato',kind,title,text,sourceUrl].join('|')).slice(0,20),
    brandId:'washoku-sato',kind,title,officialUrl,sourceUrl,
    sourceHash:hash(evidence),checkedAt,evidenceText:evidence,evidenceHash:hash(evidence),
    price:{amount,text,taxIncluded:true,from:/[〜～~]/.test(text)},
    context:{service,days:'公式掲載条件',audience:'大人',channel:'通常掲載',charge:kind==='drink'?'飲み物料金':'コース料金',subBrand:'',scope},
    comparisonKey:scope+'|reviewed-current-menu',comparisonEvidence:'reviewed-current-official-menu',
    conditions:[],targetCourses:[],exclusive:false,scopeLabel:null,imageUrl,width:null,height:null,rank:0,campaignId:null,parentHash:null,
    verificationState:'confirmed',planExistence:'confirmed',sourceMethod:'reviewed-official-menu-marker'
  };
}

// These values are emitted only while the exact current official menu edition
// marker remains on the official page. A new menu edition therefore fails
// closed instead of carrying old reviewed prices forward as fresh facts.
export function reviewedSatoCatalog(url,html,checkedAt){
  const out=[],body=String(html||''),u=new URL(url),p=u.pathname;

  // Current Shopify-backed Sato-shabu / Sato-suki pages share the same
  // versioned course-board asset. Guard on that exact asset so a future menu
  // replacement fails closed.
  const ayceBoard='https://www.sato-res.com/cdn/shop/files/other-menu.jpg?v=1790570027&width=1600';
  if((p==='/pages/sato-satoshabu'||p==='/pages/sato-satosuki')&&/other-menu\.jpg\?v=1790570027/.test(body)){
    const isSuki=p==='/pages/sato-satosuki';
    out.push(entry({
      title:isSuki?'さとすき 食べ放題（大人）':'さとしゃぶ 食べ放題（大人）',
      amount:2189,
      text:'税込2,189円〜6,149円',
      sourceUrl:url,
      officialUrl:isSuki?'https://www.sato-res.com/pages/sato-satosuki':'https://www.sato-res.com/pages/sato-satoshabu',
      checkedAt,
      evidence:`公式${isSuki?'さとすき':'さとしゃぶ'}現行コース表 other-menu.jpg v=1790570027：大人 税込2,189円〜6,149円`,
      scope:isSuki?'sato-suki-current':'sato-shabu-current',
      imageUrl:ayceBoard
    }));
  }

  // Current Shopify-backed Sato-style yakiniku page. Its reviewed course
  // board is one official image covering both adult course prices.
  const yakinikuBoard='https://www.sato-res.com/cdn/shop/files/yakiniku-menu.jpg?v=1790569988&width=1600';
  if(p==='/pages/sato-satoshikiyakiniku'&&/yakiniku-menu\.jpg\?v=1790569988/.test(body)){
    out.push(entry({
      title:'さと式焼肉 牛＆豚プレミアムコース',
      amount:4389,
      text:'税込4,389円',
      sourceUrl:url,
      officialUrl:'https://www.sato-res.com/pages/sato-satoshikiyakiniku',
      checkedAt,
      evidence:'公式さと式焼肉現行コース表 yakiniku-menu.jpg v=1790569988：牛＆豚プレミアムコース 税込4,389円',
      scope:'sato-yakiniku-current',
      imageUrl:yakinikuBoard
    }));
    out.push(entry({
      title:'さと式焼肉 黒毛和牛コース',
      amount:6479,
      text:'税込6,479円',
      sourceUrl:url,
      officialUrl:'https://www.sato-res.com/pages/sato-satoshikiyakiniku',
      checkedAt,
      evidence:'公式さと式焼肉現行コース表 yakiniku-menu.jpg v=1790569988：黒毛和牛コース 税込6,479円',
      scope:'sato-yakiniku-current',
      imageUrl:null
    }));
  }

  // Current Sato Bar page moved to /pages/sato-bar and currently states
  // 1,428 yen tax-included with a meal. Guard on that live text.
  if(p==='/pages/sato-bar'&&/1,428\s*円\s*[（(]税込[）)]/.test(body)){
    out.push(entry({title:'さとバル 120分飲み放題',kind:'drink',amount:1428,text:'税込1,428円',sourceUrl:url,officialUrl:'https://www.sato-res.com/pages/sato-bar',checkedAt,evidence:'公式さとカフェ＆さとバル：料理とセット 税込1,428円、120分',service:'通常',scope:'sato-bar-current'}));
  }
  return out;
}
