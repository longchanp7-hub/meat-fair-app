const course=/食べ放題|食べ飲み放題|飲み食べ放題|食べ放題コース|ビュッフェ|バイキング|しゃぶしゃぶコース|焼肉コース|プレミアムコース/;
const drink=/飲み放題|アルコール飲み放題|ソフトドリンク飲み放題|ドリンクバー/;

export const clean=s=>String(s||'').replace(/\s+/g,' ').replace(/^[|｜・:：\-–—\s]+|[|｜・:：\-–—\s]+$/g,'').trim();

export function taxPrice(value){
  const s=clean(value);
  let m=s.match(/[（(]\s*税込\s*[:：]?\s*[￥¥]?\s*(\d[\d,]*)\s*円?\s*[）)]\s*([〜～~])?/u);
  if(!m)m=s.match(/税込\s*[:：]?\s*[￥¥]?\s*(\d[\d,]*)\s*円?\s*([〜～~])?/u);
  if(!m)m=s.match(/[￥¥]?\s*(\d[\d,]*)\s*円\s*[（(]\s*税込\s*[）)]\s*([〜～~])?/u);
  if(!m)return{price:null,priceText:null};
  const after=s.slice((m.index??0)+m[0].length,(m.index??0)+m[0].length+16);
  if(/^\s*(?:引き|OFF|オフ|割引)/i.test(after))return{price:null,priceText:null};
  const n=Number(m[1].replace(/,/g,''));
  return{price:Number.isFinite(n)?n:null,priceText:'税込'+m[1]+'円'+(m[2]?'〜':'')};
}

export function classifyOfferKind(value){
  const s=clean(value);if(!s)return null;
  const hasCourse=course.test(s),hasDrink=drink.test(s);
  if(!hasCourse&&!hasDrink)return null;
  if(/食べ飲み放題|飲み食べ放題/.test(s))return'course';
  if(hasCourse&&hasDrink){
    if(/食べ放題.{0,120}(?:[＋+＆&]|セット|付き|含む).{0,120}飲み放題/u.test(s))return'course';
    return'drink';
  }
  return hasDrink?'drink':'course';
}

export function canonicalCourseTitle(value,kind){
  if(kind!=='course')return null;
  const s=clean(value),m=s.match(/[「『“"]([^」』”"]{2,40}(?:コース|食べ飲み放題|飲み食べ放題))[」』”"]/u);
  return m?clean(m[1]):null;
}

export function pruneIncludedRows(rows){
  const combined=rows.find(o=>o?.kind==='course'&&o?.price!=null&&/食べ放題.{0,160}飲み放題/u.test(clean(o.rawText)));
  if(!combined)return rows;
  return rows.filter(o=>{
    if(o===combined)return true;
    const raw=clean(o?.rawText);
    if(o?.kind==='course'&&o?.price==null&&/^◎?\s*コース内容/u.test(raw))return false;
    if(o?.kind==='drink'&&o?.price==null&&/ソフトドリンク.{0,100}飲み放題/u.test(raw))return false;
    return true;
  });
}
