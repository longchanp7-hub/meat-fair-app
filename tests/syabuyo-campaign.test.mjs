import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const reviews=JSON.parse(fs.readFileSync(new URL('../scripts/reviewed-campaigns-roan.json',import.meta.url),'utf8')).reviews;
const campaign=reviews.find(r=>r.brandId==='syabuyo'&&r.officialUrl==='https://www.skylark.co.jp/syabuyo/campaign/');

test('Shabuyo Silver Week campaign is hash-guarded with explicit dates and discounts',()=>{
  assert.ok(campaign,'reviewed Shabuyo campaign must exist');
  assert.match(campaign.contentHash,/^[a-f0-9]{64}$/);
  assert.equal(campaign.fields.startDate,'2026-09-19');
  assert.equal(campaign.fields.endDate,'2026-09-27');
  assert.equal(campaign.fields.campaignType,'discount');
  assert.equal(campaign.fields.allYouCanEat,true);
  assert.match(campaign.fields.priceText,/200円引き/);
  assert.match(campaign.fields.priceText,/100円引き/);
  assert.match(campaign.fields.priceText,/1,099円/);
  assert.match(campaign.fields.imageUrl,/silver_pc_01\.jpg$/);
});
