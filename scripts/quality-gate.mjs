const REQUIRED = ['id','brandId','title','officialUrl'];

export function validateCampaign(c) {
  const errors = [];
  for (const k of REQUIRED) if (!c?.[k]) errors.push(`missing:${k}`);
  if (c?.startDate && c?.endDate && c.startDate > c.endDate) errors.push('date_order_invalid');
  if (c?.regionScope === 'shizuoka' && c?.targetAreas?.includes('toyohashi')) errors.push('region_store_conflict');
  return errors;
}

export function validateDataset(data) {
  const errors = [];
  if (!data || !Array.isArray(data.campaigns)) return ['campaigns_not_array'];
  data.campaigns.forEach((c,i)=>validateCampaign(c).forEach(e=>errors.push(`${i}:${e}`)));
  return errors;
}

if (process.argv.includes('--self-test')) {
  const bad = {campaigns:[{id:'x',brandId:'b',title:'t',officialUrl:'u',startDate:'2026-10-01',endDate:'2026-09-01'}]};
  const errs = validateDataset(bad);
  if (!errs.includes('0:date_order_invalid')) process.exit(1);
  console.log('quality-gate self-test: ok');
}
