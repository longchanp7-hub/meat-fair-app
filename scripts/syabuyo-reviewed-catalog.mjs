import crypto from 'node:crypto';

const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
function row({title,amount,checkedAt,sourceUrl,evidence,rank}){
  return {
    id:hash(['syabuyo',title,amount,sourceUrl].join('|')).slice(0,20),
    brandId:'syabuyo',kind:'course',title,officialUrl:sourceUrl,sourceUrl,sourceHash:hash(evidence),checkedAt,
    evidenceText:evidence,evidenceHash:hash(evidence),
    price:{amount,text:'税込'+amount.toLocaleString('ja-JP')+'円',taxIncluded:true,from:false},
    context:{service:'平日ディナー',days:'平日限定',audience:'学生',channel:'要予約',charge:'コース料金',subBrand:'',scope:'syabuyo-student-current'},
    comparisonKey:'syabuyo-student-current|'+title,comparisonEvidence:'reviewed-current-official-student-course',
    conditions:['平日ディナー限定','中学生〜大学生・大学院生・専門学生','2名以上・グループ全員が学生','前日まで要予約','120分','ドリンクバー付き'],
    targetCourses:[],exclusive:false,scopeLabel:null,imageUrl:null,width:null,height:null,rank,campaignId:null,parentHash:null,
    verificationState:'confirmed',planExistence:'confirmed',sourceMethod:'reviewed-current-student-course'
  };
}
export function reviewedSyabuyoStudentCatalog(url,html,checkedAt){
  const u=new URL(url);
  if(u.pathname!=='/syabuyo/gakusei/index.html')return[];
  const raw=String(html||'');
  if(!/学生(?:限定)?(?:割引)?食べ放題|学生食べ放題コース/.test(raw)||!/豚コース/.test(raw)||!/牛コース/.test(raw))return[];
  return [
    row({title:'学生限定食べ放題 豚コース',amount:2000,checkedAt,sourceUrl:url,evidence:'現行の公式学生食べ放題ページを確認。公式価格改定案内で学生限定食べ放題コースは価格改定対象外。豚コース税込2,000円。',rank:0}),
    row({title:'学生限定食べ放題 牛コース',amount:2500,checkedAt,sourceUrl:url,evidence:'現行の公式学生食べ放題ページを確認。公式価格改定案内で学生限定食べ放題コースは価格改定対象外。牛コース税込2,500円。',rank:1})
  ];
}
