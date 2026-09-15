import fs from 'node:fs/promises';

const root=new URL('../app/data/',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const brands=(await read('brands.json')).brands,known=new Set(brands.map(b=>b.id));
const stores=await read('stores.json');
let changed=false;
const before=stores.stores.length;
stores.stores=stores.stores.filter(s=>known.has(s.brandId));
if(stores.stores.length!==before)changed=true;
for(const s of stores.stores){
  if(s.id==='gyukaku-hamamatsu-aritama'&&s.officialUrl!=='https://map.reins.co.jp/gyukaku/detail/535453629'){
    s.officialUrl='https://map.reins.co.jp/gyukaku/detail/535453629';changed=true;
  }
}
if(changed){stores.updatedAt=new Date().toISOString();await fs.writeFile(new URL('stores.json',root),JSON.stringify(stores,null,2)+'\n');}
console.log(JSON.stringify({storeBrands:new Set(stores.stores.map(s=>s.brandId)).size,stores:stores.stores.length,changed}));
