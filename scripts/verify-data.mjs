import fs from 'node:fs/promises';
import { validateDataset } from './quality-gate.mjs';

const brands=JSON.parse(await fs.readFile(new URL('../app/data/brands.json',import.meta.url),'utf8'));
const fairs=JSON.parse(await fs.readFile(new URL('../app/data/fairs.json',import.meta.url),'utf8'));
if(!Array.isArray(brands.brands)||brands.brands.length!==15)throw new Error(`brand count=${brands.brands?.length}`);
if(!Array.isArray(fairs.campaigns))throw new Error('campaigns not array');
if(fairs.timezone!=='Asia/Tokyo')throw new Error(`timezone=${fairs.timezone}`);
const known=new Set(brands.brands.map(b=>b.id));
for(const [i,c] of fairs.campaigns.entries())if(!known.has(c.brandId))throw new Error(`campaign ${i} unknown brand ${c.brandId}`);
const gate=validateDataset(fairs);if(gate.length)throw new Error(`dataset invalid: ${gate.join(', ')}`);
const liveByBrand=new Map();
for(const c of fairs.campaigns){if(!['ended_official','ended_by_date','stale_unverified'].includes(c.lifecycleStatus))liveByBrand.set(c.brandId,(liveByBrand.get(c.brandId)||0)+1)}
console.log(`verify ok: ${brands.brands.length} brands, ${fairs.campaigns.length} production campaigns, ${liveByBrand.size} brands with live/upcoming data`);
