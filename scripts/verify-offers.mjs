import fs from 'node:fs/promises';
const root=new URL('../app/data/',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const data=await read('offers.json'),brands=(await read('brands.json')).brands,ids=new Set(brands.map(b=>b.id));
if(data.schemaVersion!==1||!Array.isArray(data.offers)||!Array.isArray(data.sourceHealth))throw Error('offers.json schema is invalid');
if(!Number.isFinite(Date.parse(data.updatedAt)))throw Error('offers updatedAt is invalid');
const seen=new Set();
for(const o of data.offers){
  if(!ids.has(o.brandId))throw Error('Unknown offer brand '+o.brandId);
  if(!['course','drink'].includes(o.kind))throw Error('Invalid offer kind '+o.kind);
  if(typeof o.title!=='string'||!o.title.trim())throw Error('Offer title is missing');
  for(const key of ['officialUrl','sourceUrl']){let u;try{u=new URL(o[key])}catch{throw Error(`Invalid ${key}`)}if(u.protocol!=='https:')throw Error(`Unsafe ${key}`);}
  if(o.price!==null&&(!Number.isInteger(o.price)||o.price<=0))throw Error('Offer price must be a positive integer or null');
  if(o.price!==null&&!/^税込[\d,]+円(?:〜)?$/.test(o.priceText||''))throw Error('Numeric offer price requires an explicit tax-inclusive label');
  if(!Number.isFinite(Date.parse(o.checkedAt)))throw Error('Offer checkedAt is invalid');
  if(/小学生|幼児|未就学|こども|子供|お子さま|お子様|シニア|65歳|60歳|70歳/.test(o.rawText||''))throw Error('Child/senior price leaked into adult comparison');
  const key=[o.brandId,o.kind,o.title,o.priceText||'',o.officialUrl].join('|');if(seen.has(key))throw Error('Duplicate offer '+key);seen.add(key);
}
for(const b of brands)if(!data.sourceHealth.some(h=>h.brandId===b.id))throw Error('Missing offer health for '+b.id);
console.log(JSON.stringify({offers:data.offers.length,brands:brands.length,ok:true}));
