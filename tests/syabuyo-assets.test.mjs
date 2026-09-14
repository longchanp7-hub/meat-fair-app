import test from 'node:test';
import assert from 'node:assert/strict';

test('inspect current Shabu-yo highlight image URLs', async () => {
  const url='https://www.skylark.co.jp/syabuyo/menu/fair_sep/';
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 meat-fair-app test'},signal:AbortSignal.timeout(15000)});
  assert.equal(r.ok,true,`official page HTTP ${r.status}`);
  const html=await r.text();
  const matches=[];
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];
    const alt=(tag.match(/\balt=["']([^"']*)/i)||[])[1]||'';
    if(!/^(九州黒豚\s*食べ放題|黒毛和牛\s*食べ放題)/.test(alt))continue;
    const raw=(tag.match(/\b(?:data-src|src)=["']([^"']+)/i)||[])[1]||'';
    if(!raw)continue;
    matches.push({alt,url:new URL(raw,url).href});
  }
  console.log('SYABUYO_HIGHLIGHT_ASSETS='+JSON.stringify(matches));
  assert.ok(matches.some(x=>x.alt.startsWith('九州黒豚')),'Kyushu Kurobuta image missing');
  assert.ok(matches.some(x=>x.alt.startsWith('黒毛和牛')),'Kuroge Wagyu image missing');
});
