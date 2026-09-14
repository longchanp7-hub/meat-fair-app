import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const base=process.env.PAGE_URL;
if(!base||!base.startsWith('https://longchanp7-hub.github.io/meat-fair-app/'))throw Error('Unexpected public app URL');
const files=['index.html','app.js','status.mjs','styles.css','layout-wide.css','data/brands.json','data/fairs.json','data/stores.json'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let lastError;
for(let attempt=1;attempt<=12;attempt++){
  try{
    for(const file of files){
      const r=await fetch(new URL(file+`?verify=${process.env.GITHUB_RUN_ID||'local'}-${attempt}`,base),{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!r.ok)throw Error(`${file}: HTTP ${r.status}`);
      const remote=Buffer.from(await r.arrayBuffer()),local=await fs.readFile(new URL('../app/'+file,import.meta.url));
      if(hash(remote)!==hash(local))throw Error(`${file}: Pages has not propagated the deployed content yet`);
    }
    console.log(`Public app verified: all ${files.length} deployed files match their committed SHA256`);
    process.exit(0);
  }catch(e){lastError=e;console.log(`Public verification ${attempt}/12: ${e.message}`);if(attempt<12)await new Promise(r=>setTimeout(r,7000));}
}
throw lastError;
