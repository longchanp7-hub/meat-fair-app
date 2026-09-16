import test from 'node:test';
import assert from 'node:assert/strict';
import {retryableFetchError,withFetchRetries} from '../scripts/retry-fetch.mjs';

test('transient network and retryable HTTP failures are retried within the bound',async()=>{
  let calls=0;
  const result=await withFetchRetries(async()=>{
    calls++;
    if(calls===1)throw Error('fetch failed');
    if(calls===2)throw Error('HTTP 503');
    return 'ok';
  },{attempts:3,delayMs:0});
  assert.equal(result,'ok');
  assert.equal(calls,3);
});

test('semantic parsing failures are not retried',async()=>{
  let calls=0;
  await assert.rejects(()=>withFetchRetries(async()=>{calls++;throw Error('Unexpected redirect');},{attempts:3,delayMs:0}),/Unexpected redirect/);
  assert.equal(calls,1);
});

test('retry classifier is narrow enough to preserve fail-closed parsing',()=>{
  for(const message of ['fetch failed','EAI_AGAIN','HTTP 429','HTTP 502','socket closed'])assert.equal(retryableFetchError(Error(message)),true,message);
  for(const message of ['Oversized source page','Unsupported image signature','campaign_content_changed_pending_review'])assert.equal(retryableFetchError(Error(message)),false,message);
});
