// Human-readable facts verified against actual official-image browser captures.
// Reviews cannot attach to a changed page/hash or a different image URL. New
// images fall back to the normal automatic extraction; prices are not inferred.
const sourceUrl='https://www.jukusei-ichiban.jp/jp/';
const sourceHash='28ea10907550270e10f8eb763fa835497b55859454cb667e896d7232dbce0fdc';
const reviews=[
 {imageUrl:'https://www.jukusei-ichiban.jp/jp/img/top/mainVisual/nib_gland_01_202604_pc.jpg',omit:true,reason:'Four-course overview duplicates the current individually verified course boards.'},
 {imageUrl:'https://www.jukusei-ichiban.jp/jp/img/top/mainVisual/nib_gland_02_202604_pc.jpg',title:'特製たれ漬け 骨付きカルビ',courses:['いちばん食べ放題コース','牛タン食べ放題コース','黒毛和牛食べ放題コース'],exclusive:false},
 {imageUrl:'https://www.jukusei-ichiban.jp/jp/img/top/mainVisual/nib_gland_03_202604_pc.jpg',title:'いちばん熟成 上カルビ',courses:[],exclusive:false}
];
export function reviewCatalogImage(candidate,url,hash){
 if(url!==sourceUrl||hash!==sourceHash)return candidate;
 const review=reviews.find(r=>r.imageUrl===candidate.image?.imageUrl);
 if(!review)return candidate;if(review.omit)return null;
 const evidence=[candidate.evidence,'公式画像の確認済み表記：'+review.title,review.courses.length?'対象：'+review.courses.join('／'):null].filter(Boolean).join(' ');
 return {...candidate,...review,evidence,conditions:review.courses.length?'この料理は3つのコースに含まれます。最上位コースだけの限定料理ではありません。':'対象コースは公式画像・メニューで確認してください。',rank:0};
}
