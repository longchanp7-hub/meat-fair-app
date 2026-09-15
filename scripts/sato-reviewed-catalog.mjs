import crypto from 'node:crypto';

const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function entry({title,kind='course',amount,text,sourceUrl,checkedAt,evidence,service='ディナー',scope}){
  return {
    id:hash(['washoku-sato',kind,title,text,sourceUrl].join('|')).slice(0,20),
    brandId:'washoku-sato',kind,title,officialUrl:sourceUrl,sourceUrl,
    sourceHash:hash(evidence),checkedAt,evidenceText:evidence,evidenceHash:hash(evidence),
    price:{amount,text,taxIncluded:true,from:/[〜～~]/.test(text)},
    context:{service,days:'公式掲載条件',audience:'大人',channel:'通常掲載',charge:kind==='drink'?'飲み物料金':'コース料金',subBrand:'',scope},
    comparisonKey:scope+'|reviewed-current-menu',comparisonEvidence:'reviewed-current-official-menu',
    conditions:[],targetCourses:[],exclusive:false,scopeLabel:null,imageUrl:null,width:null,height:null,rank:0,campaignId:null,parentHash:null,
    verificationState:'confirmed',planExistence:'confirmed',sourceMethod:'reviewed-official-menu-marker'
  };
}

// These values are emitted only while the exact current official menu edition
// marker remains on the official page. A new menu edition therefore fails
// closed instead of carrying old reviewed prices forward as fresh facts.
export function reviewedSatoCatalog(url,html,checkedAt){
  const out=[],body=String(html||''),u=new URL(url),p=u.pathname;
  const menuEdition=/ayce-260616/.test(body);
  if(p==='/satoshabu/'&&menuEdition){
    out.push(entry({title:'さとしゃぶ 食べ放題（大人）',amount:2189,text:'税込2,189円〜6,039円',sourceUrl:url,checkedAt,evidence:'公式メニューブック ayce-260616：さとしゃぶ 大人 税込2,189円〜6,039円',scope:'sato-shabu-current'}));
  }
  if(p==='/satosuki/'&&menuEdition){
    out.push(entry({title:'さとすき 食べ放題（大人）',amount:2189,text:'税込2,189円〜6,039円',sourceUrl:url,checkedAt,evidence:'公式メニューブック ayce-260616：さとすき 大人 税込2,189円〜6,039円',scope:'sato-suki-current'}));
  }
  if(p==='/satoyaki/'&&/menu-260409-01\.jpg/.test(body)){
    out.push(entry({title:'さと式焼肉 牛＆豚プレミアムコース',amount:4279,text:'税込4,279円',sourceUrl:url,checkedAt,evidence:'公式さと式焼肉 menu-260409-01：牛＆豚プレミアムコース 税込4,279円',scope:'sato-yakiniku-current'}));
    out.push(entry({title:'さと式焼肉 黒毛和牛コース',amount:6369,text:'税込6,369円',sourceUrl:url,checkedAt,evidence:'公式さと式焼肉 menu-260409-01：黒毛和牛コース 税込6,369円',scope:'sato-yakiniku-current'}));
  }
  if(p==='/sato/bar/'&&/1,978\s*[（(]税込/.test(body)){
    out.push(entry({title:'さとバル 120分飲み放題',kind:'drink',amount:1978,text:'税込1,978円',sourceUrl:url,checkedAt,evidence:'公式さとカフェ＆さとバル：料理とセット 1,978（税込）、120分',service:'通常',scope:'sato-bar-current'}));
  }
  if(p==='/sato/en/menu/'&&/3,949\s*yen/.test(body)){
    out.push(entry({title:'さとしゃぶ 牛＆豚プレミアムコース',amount:3949,text:'税込3,949円',sourceUrl:url,checkedAt,evidence:'公式English menu：Sato Shabu Premium Course Adult 3,949 yen, all prices tax included',scope:'sato-shabu-current'}));
  }
  return out;
}
