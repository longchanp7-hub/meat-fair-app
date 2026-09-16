const TRANSIENT=/fetch failed|network|socket|EAI_AGAIN|ENOTFOUND|ECONNRESET|ETIMEDOUT|UND_ERR|TLS|aborted|HTTP (?:408|425|429|5\d\d)/i;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function retryableFetchError(error){
  return TRANSIENT.test(String(error?.message||error||''));
}

export async function withFetchRetries(operation,{attempts=3,delayMs=300,shouldRetry=retryableFetchError}={}){
  let last;
  for(let attempt=0;attempt<attempts;attempt++){
    try{return await operation(attempt);}
    catch(error){
      last=error;
      if(attempt>=attempts-1||!shouldRetry(error))throw error;
      if(delayMs>0)await sleep(delayMs*(attempt+1));
    }
  }
  throw last;
}
