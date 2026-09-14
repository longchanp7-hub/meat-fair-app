const REQUIRED=['id','brandId','title','officialUrl'];
const VALID_PRIORITIES=new Set(['P1','P2','P3','P4']);
const VALID_LIFECYCLE=new Set(['current','ended_official','ended_by_date','stale_unverified']);
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;

function validHttpUrl(v){try{const u=new URL(v);return u.protocol==='http:'||u.protocol==='https:'}catch{return false}}

export function validateCampaign(c){
  const errors=[];
  for(const k of REQUIRED)if(!c?.[k])errors.push(`missing:${k}`);
  if(c?.officialUrl&&!validHttpUrl(c.officialUrl))errors.push('official_url_invalid');
  if(c?.imageUrl&&!validHttpUrl(c.imageUrl))errors.push('image_url_invalid');
  if(c?.startDate&&!ISO_DATE.test(c.startDate))errors.push('start_date_invalid');
  if(c?.endDate&&!ISO_DATE.test(c.endDate))errors.push('end_date_invalid');
  if(c?.startDate&&c?.endDate&&c.startDate>c.endDate)errors.push('date_order_invalid');
  if(c?.priority&&!VALID_PRIORITIES.has(c.priority))errors.push('priority_invalid');
  if(c?.lifecycleStatus&&!VALID_LIFECYCLE.has(c.lifecycleStatus))errors.push('lifecycle_invalid');
  if(c?.regionScope==='shizuoka'&&c?.targetAreas?.includes('toyohashi'))errors.push('region_store_conflict');
  if(c?.targetCourses&&!Array.isArray(c.targetCourses))errors.push('target_courses_not_array');
  if(c?.targetStores&&!Array.isArray(c.targetStores))errors.push('target_stores_not_array');
  if(c?.targetAreas&&!Array.isArray(c.targetAreas))errors.push('target_areas_not_array');
  if(c?.limitedIngredients&&!Array.isArray(c.limitedIngredients))errors.push('ingredients_not_array');
  return errors;
}

export function validateDataset(data){
  const errors=[];
  if(!data||!Array.isArray(data.campaigns))return['campaigns_not_array'];
  const ids=new Set(),urls=new Set();
  data.campaigns.forEach((c,i)=>{
    validateCampaign(c).forEach(e=>errors.push(`${i}:${e}`));
    if(c?.id){if(ids.has(c.id))errors.push(`${i}:duplicate_id`);ids.add(c.id)}
    if(c?.brandId&&c?.officialUrl){const key=`${c.brandId}|${c.officialUrl}`;if(urls.has(key))errors.push(`${i}:duplicate_brand_url`);urls.add(key)}
  });
  return errors;
}

if(process.argv.includes('--self-test')){
  const bad={campaigns:[{id:'x',brandId:'b',title:'t',officialUrl:'https://example.com',startDate:'2026-10-01',endDate:'2026-09-01'},{id:'x',brandId:'b',title:'t2',officialUrl:'https://example.com'}]};
  const errs=validateDataset(bad);
  for(const expected of ['0:date_order_invalid','1:duplicate_id','1:duplicate_brand_url'])if(!errs.includes(expected))throw new Error(`self-test missing ${expected}`);
  console.log('quality-gate self-test: ok');
}
