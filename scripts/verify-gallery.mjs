import fs from 'node:fs/promises';
import {publicUrl} from './gallery-extract.mjs';
import {hasCurrentParent} from '../app/gallery-semantics.mjs';
const root=new URL('../app/data/',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const [gallery,fairs,brands]=await Promise.all([read('gallery.json'),read('fairs.json'),read('brands.json')]);
if(gallery.schemaVersion!==1||!Array.isArray(gallery.assets))throw Error('Invalid gallery schema');
if(gallery.fairsUpdatedAt!==fairs.updatedAt)throw Error('Gallery and fair snapshots disagree');
const known=new Set(brands.brands.map(b=>b.id)),ids=new Set(),keys=new Set();
if(new Set(gallery.sourceHealth.map(h=>h.brandId)).size!==known.size)throw Error('Incomplete image source coverage');
for(const a of gallery.assets){
 if(!known.has(a.brandId)||!a.id||ids.has(a.id))throw Error('Invalid/duplicate media ID');ids.add(a.id);
 const key=a.brandId+'|'+a.imageUrl;if(keys.has(key))throw Error('Duplicate media URL');keys.add(key);
 if(!publicUrl(a.imageUrl)||!publicUrl(a.officialUrl)||!publicUrl(a.sourceUrl))throw Error('Unsafe media URL');
 if(!a.title||!['campaign','detail','menu'].includes(a.kind)||!Number.isFinite(a.rank))throw Error('Invalid media metadata');
 if(!Number.isFinite(Date.parse(a.checkedAt)))throw Error('Missing media evidence time');
 if(!Number.isFinite(a.width)||!Number.isFinite(a.height)||a.width<=0||a.height<=0)throw Error('Missing media dimensions');
 if(gallery.policyVersion>=2){
  if(!a.group||!Number.isFinite(a.priority)||!Number.isFinite(a.visualWeight)||a.visualWeight<1)throw Error('Missing semantic layout metadata');
  if(a.kind==='menu'&&(!hasCurrentParent(a,fairs.campaigns)||!a.sourceHash))throw Error('Stale/orphaned related menu');
 }
 if(a.kind!=='menu'){
  const parent=fairs.campaigns.find(c=>c.id===a.campaignId&&c.brandId===a.brandId);
  if(!parent||parent.contentHash!==a.parentHash)throw Error('Stale/orphaned campaign artwork');
 }
}
console.log(JSON.stringify({galleryVerified:true,assets:gallery.assets.length,brands:known.size,warnings:gallery.errors.length}));
