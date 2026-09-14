import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const base=process.env.PAGE_URL;
if(!base||!base.startsWith('https://longchanp7-hub.github.io/meat-fair-app/'))throw Error('Unexpected public app URL');
const root=new URL('../app/',import.meta.url);
async function collect(prefix=''){
 const files=[];
 for(const e of await fs.readdir(new URL(prefix,root),{withFileTypes:true})){
  if(e.name.startsWith('.')||e.name==='candidates.json')continue;
  const name=prefix+e.name;if(e.isDirectory())files.push(...await collect(name+'/'));else files.push(name);
 }return files;
}
const files=await collect(),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let lastError;
for(let attempt=1;attempt<=12;attempt++){
 try{
  for(const file of files){
   const r=await fetch(new URL(file+`?verify=${process.env.GITHUB_RUN_ID||'local'}-${attempt}`,base),{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error(`${file}: HTTP ${r.status}`);
   if(hash(Buffer.from(await r.arrayBuffer()))!==hash(await fs.readFile(new URL(file,root))))throw Error(`${file}: deployed content has not propagated`);
  }
  console.log(`Public app verified: all ${files.length} deployed files match their SHA256`);process.exit(0);
 }catch(e){lastError=e;console.log(`Public verification ${attempt}/12: ${e.message}`);if(attempt<12)await new Promise(r=>setTimeout(r,7000));}
}
throw lastError;
