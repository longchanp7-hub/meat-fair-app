import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import crypto from 'node:crypto';
const execFileAsync=promisify(execFile);
export async function publishedFileNames(root='app',prefix=''){
 const result=[];
 for(const entry of await fs.readdir(path.join(root,prefix),{withFileTypes:true})){
  const name=prefix?prefix+'/'+entry.name:entry.name;
  if(entry.isDirectory())result.push(...await publishedFileNames(root,name));
  else if(entry.isFile())result.push(name);
 }
 return result.sort();
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function checkoutRevision(){
 try{
  const {stdout}=await execFileAsync('git',['rev-parse','HEAD'],{encoding:'utf8'});
  return stdout.trim()||process.env.GITHUB_SHA||null;
 }catch{
  return process.env.GITHUB_SHA||null;
 }
}
export async function verifyPublic(){
 const base=process.env.PAGE_URL||'https://longchanp7-hub.github.io/meat-fair-app/';
 if(base!=='https://longchanp7-hub.github.io/meat-fair-app/')throw Error('Unexpected publication target');
 const files=await publishedFileNames(),expected=new Map();
 for(const file of files)expected.set(file,hash(await fs.readFile(path.join('app',file))));
 let failed=[];
 for(let attempt=1;attempt<=12;attempt++){
  failed=[];const verified=[];
  for(let i=0;i<files.length;i+=4)await Promise.all(files.slice(i,i+4).map(async file=>{
   try{
    const response=await fetch(base+file+'?verify='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
    const actual=hash(Buffer.from(await response.arrayBuffer()));
    if(!response.ok||actual!==expected.get(file))failed.push(file);
    else verified.push({file,sha256:actual});
   }catch{failed.push(file);}
  }));
  if(!failed.length){
   const report={passed:true,url:base,verifiedAt:new Date().toISOString(),revision:await checkoutRevision(),files:verified.sort((a,b)=>a.file.localeCompare(b.file)),attempt};
   await fs.mkdir('browser-report',{recursive:true});
   await fs.writeFile('browser-report/public-byte-verification.json',JSON.stringify(report,null,2)+'\n');
   console.log('Public code/data/icons match exact checkout:',JSON.stringify(report));return report;
  }
  console.log('Waiting for public propagation',attempt,failed.join(', '));
  if(attempt<12)await new Promise(r=>setTimeout(r,10000));
 }
 throw Error('Public files are stale or unavailable: '+failed.join(', '));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyPublic();
