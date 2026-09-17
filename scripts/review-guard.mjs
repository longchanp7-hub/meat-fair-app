const norm=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
const dateForms=date=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');
  if(!m)return[];
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  return[`${y}年${mo}月${d}日`,`${y}/${mo}/${d}`,`${mo}月${d}日`,`${mo}/${d}`].map(norm);
};
function dateSupported(body,parsed,expected,key){
  if(!expected)return true;
  if(parsed?.[key])return parsed[key]===expected;
  return dateForms(expected).some(x=>body.includes(x));
}
export function reviewSemanticallySupported(review,page,dates){
  if(!review?.semanticGuard||!review.fields)return false;
  const f=review.fields,body=norm(page?.bodyText),title=norm(page?.title);
  if(!body||body.length<25)return false;
  if(!dateSupported(body,dates,f.startDate,'startDate')||!dateSupported(body,dates,f.endDate,'endDate'))return false;
  const titleTokens=norm(f.title).split(/[「」『』【】（）()・,，。:：〜～-]+/).filter(x=>x.length>=3);
  if(titleTokens.length&&!titleTokens.some(x=>title.includes(x)||body.includes(x)))return false;
  for(const course of f.targetCourses||[])if(!body.includes(norm(course)))return false;
  if((f.limitedIngredients||[]).length&&!f.limitedIngredients.some(x=>body.includes(norm(x))))return false;
  if(f.allYouCanEat===true&&!(/食べ放題/.test(page.bodyText||'')||(f.targetCourses||[]).some(x=>/コース/.test(x))))return false;
  return true;
}
