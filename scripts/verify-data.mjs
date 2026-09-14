import fs from 'node:fs/promises';
const brands=JSON.parse(await fs.readFile(new URL('../app/data/brands.json',import.meta.url),'utf8'));
const fairs=JSON.parse(await fs.readFile(new URL('../app/data/fairs.json',import.meta.url),'utf8'));
if(brands.brands.length!==15) throw new Error(`brand count=${brands.brands.length}`);
if(!Array.isArray(fairs.campaigns)) throw new Error('campaigns not array');
console.log(`verify ok: ${brands.brands.length} brands, ${fairs.campaigns.length} production campaigns`);
