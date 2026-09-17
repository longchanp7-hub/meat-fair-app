import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TARGET_BRAND_IDS,TARGET_BRANDS} from '../scripts/target-brands.mjs';
import {SOURCES} from '../scripts/source-registry.mjs';
import {visibleBrand} from '../app/presentation.mjs';

const brands=JSON.parse(fs.readFileSync(new URL('../app/data/brands.json',import.meta.url),'utf8')).brands;

test('permanent target set is exactly the fourteen configured brands',()=>{
 const ids=brands.map(b=>b.id);
 assert.equal(TARGET_BRAND_IDS.length,14);assert.equal(TARGET_BRANDS.size,14);
 assert.deepEqual(new Set(ids),TARGET_BRANDS);
 assert.deepEqual(new Set(SOURCES.map(x=>x.brandId)),TARGET_BRANDS);
 for(const id of TARGET_BRAND_IDS)assert.equal(visibleBrand(id),true);
});

test('Kushiya and any unconfigured future brand cannot leak into collection or UI',()=>{
 assert.equal(TARGET_BRANDS.has('kushiya-monogatari'),false);
 assert.equal(SOURCES.some(x=>x.brandId==='kushiya-monogatari'),false);
 assert.equal(visibleBrand('kushiya-monogatari'),false);
 assert.equal(visibleBrand('unknown-future-chain'),false);
});
