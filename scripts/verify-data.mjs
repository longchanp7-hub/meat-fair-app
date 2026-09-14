import fs from 'node:fs/promises';
import {validateDataset} from './quality-gate.mjs';
import {SOURCES} from './source-registry.mjs';
import {duplicateAnnouncements} from './campaign-aliases.mjs';
import {campaignStatus} from '../app/status.mjs';

const brands=JSON.parse(await fs.readFile(new URL('../app/data/brands.json',import.meta.url),'utf8'));
const fairs=JSON.parse(await fs.readFile(new URL('../app/data/fairs.json',import.meta.url),'utf8'));
const stores=JSON.parse(await fs.readFile(new URL('../app/data/stores.json',import.meta.url),'utf8'));
const known=new Set(brands.brands?.map(b=>b.id));
if(brands.brands?.length!==15||known.size!==15)throw Error('Expected 15 distinct brands');
if(SOURCES.length!==15||SOURCES.some(b=>!known.has(b.brandId)))throw Error('Source registry and UI brands disagree');
if(fairs.schemaVersion!==2||fairs.timezone!=='Asia/Tokyo')throw Error('Invalid public schema or timezone');
if(!Number.isFinite(Date.parse(fairs.updatedAt)))throw Error('Missing update timestamp');
const gate=validateDataset(fairs);if(gate.length)throw Error('Invalid campaigns: '+gate.join(', '));
const health=fairs.sourceHealth||[],healthIds=new Set(health.map(h=>h.brandId));
if(health.length!==15||healthIds.size!==15||health.some(h=>!known.has(h.brandId)))throw Error('Incomplete source health');
for(const h of health){
  if(!['ok','partial','unavailable','needs_review'].includes(h.status))throw Error('Unknown source status');
  if(typeof h.sourceOk!=='boolean'||!Number.isFinite(Date.parse(h.checkedAt)))throw Error('Invalid source check');
  if(h.status==='ok'&&!h.sourceOk)throw Error('Unavailable source marked OK');
}
for(const c of fairs.campaigns){
  if(!known.has(c.brandId))throw Error(`Unknown campaign brand: ${c.brandId}`);
  if(!Array.isArray(c.conditions)||!Array.isArray(c.targetCourses))throw Error(`Invalid conditions: ${c.id}`);
  if(c.imageUrl&&/\.(?:pdf|svg|html)(?:\?|$)/i.test(c.imageUrl))throw Error(`Not a food image: ${c.id}`);
  if(c.lifecycleStatus==='stale_unverified')throw Error(`Unreviewed candidate leaked into public data: ${c.id}`);
  if(c.verificationState==='reviewed'&&!c.contentHash)throw Error(`Missing evidence hash: ${c.id}`);
}
if(duplicateAnnouncements(fairs.campaigns).length)throw Error('Duplicate announcement and campaign landing page in public data');

const allowedAreas=new Set(stores.areas||[]),storeRows=stores.stores||[],storeIds=new Set();
if(stores.schemaVersion!==1||allowedAreas.size!==5)throw Error('Invalid store registry schema or area list');
if(!Number.isFinite(Date.parse(stores.updatedAt)))throw Error('Missing store update timestamp');
for(const s of storeRows){
  if(!s?.id||storeIds.has(s.id))throw Error(`Duplicate or missing store id: ${s?.id||'(missing)'}`);
  storeIds.add(s.id);
  if(!known.has(s.brandId))throw Error(`Unknown store brand: ${s.brandId}`);
  if(!allowedAreas.has(s.area))throw Error(`Unknown store area: ${s.id}:${s.area}`);
  if(!s.name||!/^https:\/\//.test(s.officialUrl||''))throw Error(`Invalid store record: ${s.id}`);
  if(!Array.isArray(s.campaignOverrides))throw Error(`Invalid store overrides: ${s.id}`);
}
const storeBrandIds=new Set(storeRows.map(s=>s.brandId));
if(storeBrandIds.size!==15||[...known].some(id=>!storeBrandIds.has(id)))throw Error('Local store registry does not cover all 15 brands');

const states=fairs.campaigns.map(c=>({...c,...campaignStatus(c)}));
const live=states.filter(c=>c.state!=='ended');
console.log(JSON.stringify({verified:true,brands:known.size,readableSources:health.filter(h=>h.sourceOk).length,
  campaigns:fairs.campaigns.length,active:states.filter(c=>c.state==='active').length,upcoming:states.filter(c=>c.state==='upcoming').length,
  brandsWithLiveData:new Set(live.map(c=>c.brandId)).size,localStores:storeRows.length,storeBrands:storeBrandIds.size,updatedAt:fairs.updatedAt}));
