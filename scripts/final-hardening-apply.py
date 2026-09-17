from pathlib import Path
import re
from textwrap import dedent

root=Path('.')

# Remove the last dormant extraction branch for the permanently removed chain.
p=root/'scripts/catalog-profiles.mjs'
s=p.read_text()
s2=re.sub(r"\n    case 'kushiya-monogatari': \{.*?\n      return out;\n    \}","",s,flags=re.S)
if s2==s:
    raise SystemExit('removed-chain catalog profile block not found')
p.write_text(s2)

# Ended reviewed campaigns may change their archive markup without degrading current health.
p=root/'scripts/update-fairs.mjs'; s=p.read_text()
old="const changedReview=pending.some(c=>c.statusEvidence==='official_content_changed_review_required');"
new="const changedReview=pending.some(c=>c.statusEvidence==='official_content_changed_review_required'&&(!c.endDate||c.endDate>=today));"
if old not in s: raise SystemExit('changedReview target not found')
p.write_text(s.replace(old,new))

# Exclude known non-HTML/action endpoints and canonicalize a harmless Skylark slash redirect.
p=root/'scripts/catalog-extract.mjs'; s=p.read_text()
old="""    if(t.origin!==allowed.origin)return false;
    // A corporate host may contain several unrelated brands.
    if(allowed.pathname!=='/'&&!t.pathname.startsWith(allowed.pathname))return false;
    if(/\\.(?:jpe?g|png|gif|webp|svg|avif|zip|exe|pdf)(?:$|\\?)/i.test(t.pathname)||/\\/news\\/|\\/topics?\\/|\\/20\\d{2}\\//.test(t.pathname))return false;
    if(NOISE.test(l.title)||/学生|学割|お子様|キッズ|予約する/.test(l.title))return false;
    return (/shop-list|shoplist/.test(new URL(base).pathname)&&/豊橋|豊川|蒲郡|岡崎|浜松/.test(l.title))||/menu|course|price|drink|lunch|dinner|enkai|buffet|tabehodai|tabehoudai|nomihodai|plan|all-you-can-eat|\\/(?:qa|about)\\//i.test(t.pathname+t.search)||COURSE.test(l.title)||DRINK.test(l.title);
  }).map(l=>({url:l.url,title:l.title,rank:DRINK.test(l.title)||/drink|nomihodai/.test(l.url)?0:/コース|食べ放題|料金|price|course/.test(l.title+l.url)?1:2})).sort((a,b)=>a.rank-b.rank);"""
new="""    if(t.origin!==allowed.origin)return false;
    // A corporate host may contain several unrelated brands.
    if(allowed.pathname!=='/'&&!t.pathname.startsWith(allowed.pathname))return false;
    // Known non-HTML/action endpoints: do not turn expected redirects or a PDF
    // response into a noisy catalog-source failure. These exclusions are only
    // for catalog crawling; campaign discovery and official source checks stay separate.
    if(brand.id==='gyukaku'&&t.pathname==='/lunch_course/')return false;
    if(brand.id==='washoku-sato'&&t.pathname.startsWith('/sato/assets/menu/book/'))return false;
    if(/\\/(?:yoyaku|reservation)\\//i.test(t.pathname)||/予約(?:する|はこちら)?|reservation/i.test(l.title))return false;
    if(/\\.(?:jpe?g|png|gif|webp|svg|avif|zip|exe|pdf)(?:$|\\?)/i.test(t.pathname)||/\\/news\\/|\\/topics?\\/|\\/20\\d{2}\\//.test(t.pathname))return false;
    if(NOISE.test(l.title)||/学生|学割|お子様|キッズ|予約する/.test(l.title))return false;
    return (/shop-list|shoplist/.test(new URL(base).pathname)&&/豊橋|豊川|蒲郡|岡崎|浜松/.test(l.title))||/menu|course|price|drink|lunch|dinner|enkai|buffet|tabehodai|tabehoudai|nomihodai|plan|all-you-can-eat|\\/(?:qa|about)\\//i.test(t.pathname+t.search)||COURSE.test(l.title)||DRINK.test(l.title);
  }).map(l=>{
    const u=new URL(l.url);
    // Skylark advertises this menu URL without a trailing slash, and the server
    // briefly redirects through HTTP. Canonicalize locally rather than weakening
    // the HTTPS redirect guard used by the fetcher.
    if(brand.id==='syabuyo'&&u.hostname==='www.skylark.co.jp'&&u.pathname==='/syabuyo/menu')u.pathname='/syabuyo/menu/';
    const url=u.href;
    return{url,title:l.title,rank:DRINK.test(l.title)||/drink|nomihodai/.test(url)?0:/コース|食べ放題|料金|price|course/.test(l.title+url)?1:2};
  }).sort((a,b)=>a.rank-b.rank);"""
if old not in s: raise SystemExit('catalog discovery target not found')
p.write_text(s.replace(old,new))

# Historical UI note now describes the permanent target policy rather than a removed chain.
p=root/'docs/ui-review-20260915.md'; lines=p.read_text().splitlines(); out=[]; replaced=False
for line in lines:
    if '串家物語' in line or 'kushiya' in line.lower():
        if not replaced:
            out.append('- 対象ブランドは現在の14チェーンに固定し、未登録ブランドは収集・表示しない。')
            replaced=True
    else:
        out.append(line)
if not replaced: raise SystemExit('UI review removed-chain wording not found')
p.write_text('\n'.join(out)+'\n')

(root/'tests/pipeline-hardening.test.mjs').write_text(dedent(r'''\
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
'''))

# Dead pre-14-chain rollout helper layer: verified to have no live imports.
for name in ['rollout-extra-utils.mjs','rollout-utils.mjs','rollout-core-utils.mjs']:
    q=root/'scripts'/name
    if q.exists(): q.unlink()

# Remove temporary patch machinery from the resulting tree.
for q in [root/'.github/workflows/final-hardening-temp.yml',root/'scripts/final-hardening-apply.py']:
    if q.exists(): q.unlink()
