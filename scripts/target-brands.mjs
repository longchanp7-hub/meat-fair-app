export const TARGET_BRAND_IDS=[
  'yakiniku-king','gyukaku','syabuyo','yuzuan','washoku-sato','amiyakitei','onyasai',
  'roan','kalubi-taisho','stamina-taro','asakuma','nikusho-sakai','jukusei-ichiban','anrakutei'
];
export const TARGET_BRANDS=new Set(TARGET_BRAND_IDS);
export function isTargetBrand(id){return TARGET_BRANDS.has(id);}
