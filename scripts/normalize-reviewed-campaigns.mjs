import fs from 'node:fs/promises';
import {TARGET_BRANDS} from './target-brands.mjs';

const url=new URL('./reviewed-campaigns.json',import.meta.url);
const data=JSON.parse(await fs.readFile(url,'utf8'));
if(data.schemaVersion!==1||!Array.isArray(data.reviews))throw Error('reviewed-campaigns.json schema is invalid');
const before=data.reviews.length;
data.reviews=data.reviews.filter(r=>TARGET_BRANDS.has(r.brandId));
const seen=new Set();
for(const r of data.reviews){
  const key=r.brandId+'|'+r.officialUrl;
  if(seen.has(key))throw Error('duplicate reviewed campaign: '+key);
  seen.add(key);
}
if(data.reviews.length!==before)await fs.writeFile(url,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({reviewedCampaigns:data.reviews.length,removedUnsupported:before-data.reviews.length}));
