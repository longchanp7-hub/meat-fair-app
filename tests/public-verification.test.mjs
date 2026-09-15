import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {publishedFileNames} from '../scripts/verify-public.mjs';
test('publication verification includes new catalog modules, data and binary icons, not just a fixed legacy list',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'meat-public-'));
 try{
  await fs.mkdir(path.join(root,'data'));await fs.mkdir(path.join(root,'icons'));
  for(const name of ['index.html','catalog.mjs','data/catalog.json','icons/icon.png'])await fs.writeFile(path.join(root,name),Buffer.from([0,1,2,255]));
  assert.deepEqual(await publishedFileNames(root),['catalog.mjs','data/catalog.json','icons/icon.png','index.html']);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
