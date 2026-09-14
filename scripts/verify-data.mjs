import fs from 'node:fs/promises';
import {validateDataset} from './quality-gate.mjs';
import {SOURCES} from './source-registry.mjs';
import {campaignStatus} from '../app/status.mjs';

const brands=JSON.parse(await fs.readFile(new URL('../app/data/brands.json',import.meta.url),'utf8'));
const fairs=JSON.parse(await fs.readFile(new URL('../app/data/fairs.json',import.meta.url),'utf8'));
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
const states=fairs.campaigns.map(c=>({...c,...campaignStatus(c)}));
const live=states.filter(c=>c.state!=='ended');
console.log(JSON.stringify({verified:true,brands:known.size,readableSources:health.filter(h=>h.sourceOk).length,
  campaigns:fairs.campaigns.length,active:states.filter(c=>c.state==='active').length,upcoming:states.filter(c=>c.state==='upcoming').length,
  brandsWithLiveData:new Set(live.map(c=>c.brandId)).size,updatedAt:fairs.updatedAt}));
