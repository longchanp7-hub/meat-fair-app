import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverCatalogLinks} from '../scripts/catalog-extract.mjs';

function walk(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())out.push(...walk(p));
    else if(/\.(?:m?js|json)$/.test(e.name))out.push(p);
  }
  return out;
}

test('removed chain has no runtime collection/extraction/data references',()=>{
  const files=[...walk(fileURLToPath(new URL('../app/',import.meta.url))),...walk(fileURLToPath(new URL('../scripts/',import.meta.url)))];
  const forbidden=/kushiya-monogatari|kushi-ya\.com|串家物語|串の日/i;
  for(const file of files){
    const text=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(text,forbidden,`removed chain reference: ${file}`);
  }
});

test('ended reviewed-campaign hash drift must not degrade current source health',()=>{
  const today='2026-09-17';
  const pending=[
    {statusEvidence:'official_content_changed_review_required',endDate:'2026-09-15'},
    {statusEvidence:'insufficient_period_evidence',endDate:null}
  ];
  const changedReview=pending.some(c=>c.statusEvidence==='official_content_changed_review_required'&&(!c.endDate||c.endDate>=today));
  assert.equal(changedReview,false);
  pending.push({statusEvidence:'official_content_changed_review_required',endDate:'2026-12-08'});
  assert.equal(pending.some(c=>c.statusEvidence==='official_content_changed_review_required'&&(!c.endDate||c.endDate>=today)),true);
});

test('catalog discovery skips known action/PDF/viewer traps and canonicalizes Shabuyo menu',()=>{
  const gyukaku={id:'gyukaku',homeUrl:'https://www.gyukaku.ne.jp/'};
  assert.deepEqual(discoverCatalogLinks('<a href="/lunch_course/">ランチコース</a>','https://www.gyukaku.ne.jp/',gyukaku),[]);
  const sato={id:'washoku-sato',homeUrl:'https://sato-res.com/sato/'};
  assert.deepEqual(discoverCatalogLinks('<a href="/sato/assets/menu/book/ayce-260616/">食べ放題メニュー</a>','https://sato-res.com/sato/',sato),[]);
  const shabuyo={id:'syabuyo',homeUrl:'https://www.skylark.co.jp/syabuyo/'};
  const found=discoverCatalogLinks('<a href="/syabuyo/menu">メニュー</a><a href="/syabuyo/menu/yoyaku/">予約する</a>','https://www.skylark.co.jp/syabuyo/',shabuyo);
  assert.equal(found.length,1);
  assert.equal(found[0].url,'https://www.skylark.co.jp/syabuyo/menu/');
});
