import {
  CORE_ROLLOUT_IDS, coreTitleRelevant, rawCoreUrls, allowedCorePath, adjustCoreFields
} from './rollout-core-utils.mjs';
import {
  FINAL_ROLLOUT_IDS, extraTitleRelevant, rawExtraUrls, allowedExtraPath, adjustExtraFields
} from './rollout-extra-utils.mjs';

export const NEXT_ROLLOUT_IDS=[...CORE_ROLLOUT_IDS,...FINAL_ROLLOUT_IDS];

export function rolloutTitleRelevant(brandId,title=''){
  return CORE_ROLLOUT_IDS.includes(brandId)
    ? coreTitleRelevant(brandId,title)
    : extraTitleRelevant(brandId,title);
}

export function rawRolloutUrls(brandId,html,base){
  return CORE_ROLLOUT_IDS.includes(brandId)
    ? rawCoreUrls(brandId,html,base)
    : rawExtraUrls(brandId,html,base);
}

export function allowedRolloutPath(brandId,url){
  return CORE_ROLLOUT_IDS.includes(brandId)
    ? allowedCorePath(brandId,url)
    : allowedExtraPath(brandId,url);
}

export function adjustRolloutFields(brandId,title,text,base){
  return CORE_ROLLOUT_IDS.includes(brandId)
    ? adjustCoreFields(brandId,title,text,base)
    : adjustExtraFields(brandId,title,text,base);
}
