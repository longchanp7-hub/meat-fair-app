import test from 'node:test';
import assert from 'node:assert/strict';

test('inspect current Shabu-yo highlight image URLs', async () => {
  const url='https://www.skylark.co.jp/syabuyo/menu/fair_sep/';
  const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 meat-fair-app test'},signal:AbortSignal.timeout(15000)});
  assert.equal(r.ok,true,`official page HTTP ${r.status}`);
  const html=await r.text();
  const images=[];
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=m[0];
    const alt=(tag.match(/\balt=["']([^"']*)/i)||[])[1]||'';
    const raw=(tag.match(/\b(?:data-src|src)=["']([^"']+)/i)||[])[1]||'';
    if(raw)images.push({alt,url:new URL(raw,url).href});
  }
  const interesting=images.filter(x=>/九州黒豚|黒毛和牛|和牛/.test(x.alt));
  console.log('SYABUYO_HIGHLIGHT_ASSETS='+JSON.stringify(interesting));
  const snippets=[];
  for(const m of html.matchAll(/黒毛和牛/g)){
    snippets.push(html.slice(Math.max(0,m.index-650),Math.min(html.length,m.index+650)).replace(/\s+/g,' '));
    if(snippets.length>=6)break;
  }
  console.log('SYABUYO_WAGYU_SNIPPETS='+JSON.stringify(snippets));
  assert.ok(interesting.some(x=>x.alt.includes('九州黒豚')),'Kyushu Kurobuta image missing');
});
