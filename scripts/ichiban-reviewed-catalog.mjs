import crypto from 'node:crypto';

const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
export function reviewedIchibanStudentCatalog(url,html,checkedAt){
  const u=new URL(url),raw=String(html||'');
  if(u.pathname!=='/jp/menu/'||!/student_menu_link\.pdf/.test(raw))return[];
  const title='学生グループ専用 食べ放題';
  const evidence='公式学生専用メニューPDF：平日限定・中学生以上の学生2名以上・60品以上・税込2,500円・100分・ドリンクバー／デザートバー付き';
  return [{
    id:hash(['jukusei-ichiban',title,url].join('|')).slice(0,20),
    brandId:'jukusei-ichiban',kind:'course',title,
    officialUrl:'https://www.jukusei-ichiban.jp/jp/menu/student_menu_link.pdf',sourceUrl:url,sourceHash:hash(raw),checkedAt,
    evidenceText:evidence,evidenceHash:hash(evidence),
    price:{amount:2500,text:'税込2,500円',taxIncluded:true,from:false},
    context:{service:'食べ放題',days:'平日限定',audience:'学生',channel:'通常掲載',charge:'コース料金',subBrand:'',scope:'ichiban-student-current'},
    comparisonKey:'ichiban-student-current',comparisonEvidence:'reviewed-linked-official-pdf',
    conditions:['平日限定','中学生以上の学生2名以上','グループ全員の学生証等を提示','100分（ラストオーダー20分前）','60品以上','ドリンクバー・デザートバー付き','板橋高島平店・東大和店・北谷店は対象外','他クーポン・優待との併用不可'],
    targetCourses:[],exclusive:false,scopeLabel:null,imageUrl:null,width:null,height:null,rank:0,campaignId:null,parentHash:null,
    verificationState:'confirmed',planExistence:'confirmed',sourceMethod:'reviewed-linked-official-pdf'
  }];
}
