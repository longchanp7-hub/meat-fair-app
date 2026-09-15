import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Unit-test rendering and filter logic without a network or browser dependency.
// campaignStatus and gallery rendering are intentionally stubbed; this is not
// an end-to-end visual, collector, or PWA test.
const source = fs.readFileSync(new URL('../app/app.js', import.meta.url), 'utf8');
const marker = source.indexOf('async function getJson');
assert.ok(marker > 0, 'Application render entry points must exist');
const renderSource = source.slice(0, marker).replace(/^import .*;\n/gm, '');
function harness() {
  const elements = Object.fromEntries(['#brand-grid', '#clear-filter', '#campaign-list', '#list-title', '#data-status', '#updated-at'].map(key => [key, {innerHTML: '', textContent: '', hidden: false, scrollIntoView() {}}]));
  const buttons = Array.from({length: 15}, (_, i) => ({dataset: {brand: `b${i + 1}`}}));
  const context = vm.createContext({URL, console,
    campaignStatus: c => ({state: c.testState || 'active', isNew: !!c.testNew, endingSoon: !!c.testEnding}),
    renderGallery: () => '', enhanceGalleries() {},
    document: {querySelector: key => elements[key], querySelectorAll: key => key === '.brand' ? buttons : []}
  });
  vm.runInContext(renderSource, context);
  const run = code => vm.runInContext(code, context);
  run(`brandsData={brands:Array.from({length:15},(_,i)=>({id:'b'+(i+1),name:'チェーン'+(i+1),order:i+1,category:'yakiniku',homeUrl:'https://example.com/'}))};
    fairsData={campaigns:[{id:'a',brandId:'b1',title:'季節のフェア',priority:'P1',testState:'active',testNew:true,testEnding:true,officialUrl:'https://example.com/a'},{id:'u',brandId:'b1',title:'次回フェア',priority:'P2',testState:'upcoming',officialUrl:'https://example.com/u'}],sourceHealth:[]};storesData={stores:[]};mediaData={assets:[]};`);
  return {run, elements, buttons};
}
test('all fifteen chain controls contain names only, without campaign counters', () => {
  const h=harness(); h.run('renderBrands()'); const html=h.elements['#brand-grid'].innerHTML;
  assert.equal((html.match(/<button /g)||[]).length,15);
  assert.doesNotMatch(html, /件|class="meta"|開催中|近日開始/);
  for(let i=1;i<=15;i++) assert.ok(html.includes(`<b>チェーン${i}</b>`));
});
test('chain names remain escaped and selection remains accessible', () => {
  const h=harness(); h.run(`brandsData.brands[0].name='<img src=x onerror=x>';brandFilter='b1';renderBrands()`);
  const html=h.elements['#brand-grid'].innerHTML;
  assert.ok(html.includes('&lt;img src=x onerror=x&gt;')); assert.ok(!html.includes('<img'));
  assert.match(html,/data-brand="b1" aria-pressed="true"/); assert.equal(h.elements['#clear-filter'].hidden,false);
});
test('clicking a chain filters, and clicking it again restores fifteen cards', () => {
  const h=harness(); h.run('renderBrands();renderList()'); h.buttons[0].onclick();
  assert.equal((h.elements['#campaign-list'].innerHTML.match(/<article /g)||[]).length,1);
  assert.equal(h.run('brandFilter'),'b1'); h.buttons[0].onclick();
  assert.equal((h.elements['#campaign-list'].innerHTML.match(/<article /g)||[]).length,15);
  assert.equal(h.run('brandFilter'),null); assert.equal(h.elements['#clear-filter'].hidden,true);
});
test('card headings retain statuses but remove both count locations', () => {
  const h=harness(); const html=h.run('brandCard(brandsData.brands[0],fairsData.campaigns)');
  assert.ok(html.includes('開催中 ・ 近日開始')); assert.doesNotMatch(html,/\d+件|<small>2<\/small>/);
  assert.equal((html.match(/class="fair-row"/g)||[]).length,2);
});
test('all four tab predicates remain unchanged', () => {
  const h=harness();
  for(const [tab,id] of [['active','a'],['new','a'],['upcoming','u'],['ending','a']]) {
    assert.equal(h.run(`fairsData.campaigns.filter(c=>matchesTab(c,'${tab}')).map(c=>c.id).join(',')`),id);
  }
});
test('source-health warnings and nearby availability are not removed', () => {
  const h=harness(); h.run(`fairsData.sourceHealth=[{brandId:'b1',status:'partial'}]`);
  const html=h.run('brandCard(brandsData.brands[0],[fairsData.campaigns[0]])');
  assert.ok(html.includes('一部の公式情報は再確認が必要です。')); assert.ok(html.includes('近隣店舗での実施・対象コース'));
});
test('unavailable data are not presented as no fair', () => {
  const h=harness(); h.run(`fairsData.campaigns=[];fairsData.sourceHealth=[{brandId:'b1',status:'unavailable'}]`);
  const html=h.run('brandCard(brandsData.brands[0],[])');
  assert.ok(html.includes('「フェアなし」とは判断していません。')); assert.doesNotMatch(html,/\d+件/);
});
test('internal upcoming count still guides the reader to the right tab', () => {
  const h=harness(); assert.equal(h.run("countFor('b1','upcoming')"),1);
  assert.ok(h.run('brandCard(brandsData.brands[0],[])').includes('上の「近日開始」タブで確認できます。'));
});
