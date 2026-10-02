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

  // Current Shopify-backed Sato-shabu page. Guard on the exact versioned
  // official course-board asset so a future menu replacement fails closed.
  const shabuBoard='https://www.sato-res.com/cdn/shop/files/other-menu.jpg?v=1790570027&width=1600';
  if(p==='/pages/sato-satoshabu'&&/other-menu\.jpg\?v=1790570027/.test(body)){
    out.push(entry({
      title:'さとしゃぶ 食べ放題（大人）',
      amount:2189,
      text:'税込2,189円〜6,149円',
      sourceUrl:url,
      officialUrl:'https://www.sato-res.com/pages/sato-satoshabu',
      checkedAt,
      evidence:'公式さとしゃぶ現行コース表 other-menu.jpg v=1790570027：大人 税込2,189円〜6,149円',
      scope:'sato-shabu-current',
      imageUrl:shabuBoard
    }));
  }

  // Legacy Japanese pages that remain first-party and carry their own exact
  // menu-image markers. Keep them fail-closed by edition filename.
  if(p==='/satoyaki/'&&/menu-260409-01\.jpg/.test(body)){
    out.push(entry({title:'さと式焼肉 牛＆豚プレミアムコース',amount:4279,text:'税込4,279円',sourceUrl:url,checkedAt,evidence:'公式さと式焼肉 menu-260409-01：牛＆豚プレミアムコース 税込4,279円',scope:'sato-yakiniku-current',imageUrl:'https://sato-res.com/satoyaki/assets/images/menu-260409-01.jpg'}));
    out.push(entry({title:'さと式焼肉 黒毛和牛コース',amount:6369,text:'税込6,369円',sourceUrl:url,checkedAt,evidence:'公式さと式焼肉 menu-260409-01：黒毛和牛コース 税込6,369円',scope:'sato-yakiniku-current',imageUrl:'https://sato-res.com/satoyaki/assets/images/menu-260409-02.jpg'}));
  }

  // Current Sato Bar page moved to /pages/sato-bar and currently states
  // 1,428 yen tax-included with a meal. Guard on that live text.
  if(p==='/pages/sato-bar'&&/1,428\s*円\s*[（(]税込[）)]/.test(body)){
    out.push(entry({title:'さとバル 120分飲み放題',kind:'drink',amount:1428,text:'税込1,428円',sourceUrl:url,checkedAt,evidence:'公式さとカフェ＆さとバル：料理とセット 税込1,428円、120分',service:'通常',scope:'sato-bar-current'}));
  }
  return out;
}
