import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual rendering functions with isolated document/gallery stubs.
// These checks do not replace browser, PWA, or official-data integration tests.
const source=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const bootstrap=source.indexOf('\ntry{\n [brandsData,fairsData,storesData,mediaData]');
assert.ok(bootstrap>0,'Locate the asynchronous bootstrap before evaluating renderer definitions');
const definitions=source.slice(0,bootstrap).replace(/^import[^\n]*\n/gm,'');
const brands=[
 {id:'test-a',name:'試験チェーン A',category:'yakiniku',order:1,homeUrl:'https://example.com/a'},
 {id:'test-b',name:'試験チェーン <B>',category:'buffet',order:2,homeUrl:'https://example.com/b'}
];
const campaigns=[
 {id:'active',brandId:'test-a',title:'開催中フェア',priority:'P1',state:'active',isNew:false,endingSoon:false,officialUrl:'https://example.com/fair'},
 {id:'upcoming',brandId:'test-a',title:'近日フェア',priority:'P2',state:'upcoming',isNew:false,endingSoon:false,officialUrl:'https://example.com/next'},
 {id:'new',brandId:'test-b',title:'新着フェア',priority:'P1',state:'active',isNew:true,endingSoon:false,officialUrl:'https://example.com/new'},
 {id:'ending',brandId:'test-b',title:'終了間近フェア',priority:'P2',state:'active',isNew:false,endingSoon:true,officialUrl:'https://example.com/ending'},
 {id:'ended',brandId:'test-a',title:'終了済みフェア',priority:'P1',state:'ended',isNew:true,endingSoon:false,officialUrl:'https://example.com/ended'}
];
function setup(sourceHealth=[]){
 const elements=new Map();
 const get=selector=>{
  if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',hidden:true,scrollIntoView(){}});
  return elements.get(selector);
 };
 const buttons=brands.map(b=>({dataset:{brand:b.id}}));
 const context=vm.createContext({
  URL,Date,console,
  renderGallery:()=>'<div data-gallery-test="true"></div>',enhanceGalleries(){},
  campaignStatus:c=>({state:c.state,isNew:c.isNew,endingSoon:c.endingSoon}),
  document:{querySelector:get,querySelectorAll:selector=>selector==='.brand'?buttons:[]},
  fixtures:{brands,campaigns,sourceHealth}
 });
 vm.runInContext(definitions,context);
 vm.runInContext('brandsData={brands:fixtures.brands};fairsData={campaigns:fixtures.campaigns,sourceHealth:fixtures.sourceHealth};storesData={stores:[]};mediaData={assets:[]};',context);
 return {get,buttons,run:code=>vm.runInContext(code,context)};
}

test('chain filters show only escaped brand names, not counts or health badges',()=>{
 const {run,get}=setup([{brandId:'test-a',status:'partial'}]);
 run('renderBrands()');
 const html=get('#brand-grid').innerHTML;
 assert.match(html,/<b>試験チェーン A<\/b>/);
 assert.match(html,/<b>試験チェーン &lt;B&gt;<\/b>/);
 assert.equal((html.match(/<button/g)||[]).length,2);
 assert.doesNotMatch(html,/[0-9]+件|class="meta"|開催状況|一部要確認/);
});

test('brand filter selection and deselection still work',()=>{
 const {run,get,buttons}=setup();
 run('renderBrands()');
 buttons[0].onclick();
 assert.equal(run('brandFilter'),'test-a');
 assert.match(get('#brand-grid').innerHTML,/class="brand selected" data-brand="test-a" aria-pressed="true"/);
 assert.equal(get('#clear-filter').hidden,false);
 assert.match(get('#campaign-list').innerHTML,/data-brand-card="test-a"/);
 assert.doesNotMatch(get('#campaign-list').innerHTML,/data-brand-card="test-b"/);
 buttons[0].onclick();
 assert.equal(run('brandFilter'),null);
 assert.equal(get('#clear-filter').hidden,true);
});

test('cards keep state labels, campaign details and warnings but omit counts',()=>{
 const {run}=setup([{brandId:'test-a',status:'partial'}]);
 const html=run("brandCard(brandsData.brands[0],fairsData.campaigns.filter(c=>c.brandId==='test-a'&&c.state!=='ended'))");
 assert.match(html,/開催中 ・ 近日開始/);
 assert.match(html,/開催中フェア/);
 assert.match(html,/近日フェア/);
 assert.match(html,/一部の公式情報は再確認が必要/);
 assert.match(html,/data-gallery-test/);
 assert.match(html,/公式サイトへ/);
 assert.doesNotMatch(html,/[0-9]+件/);
});

test('all four status tabs retain filtering and do not expose count badges',()=>{
 const {run,get}=setup();
 const expected={active:['active','new','ending'],new:['new'],upcoming:['upcoming'],ending:['ending']};
 for(const [tab,ids] of Object.entries(expected)){
  run(`tab=${JSON.stringify(tab)};renderList()`);
  const html=get('#campaign-list').innerHTML;
  const actual=[...html.matchAll(/data-campaign="([^"]+)"/g)].map(m=>m[1]).sort();
  assert.deepEqual(actual,[...ids].sort(),tab);
  assert.doesNotMatch(html,/[0-9]+件/,tab);
 }
});

test('internal counts remain available without rendering them',()=>{
 const {run}=setup();
 assert.equal(run("countFor('test-a','active')"),1);
 assert.equal(run("countFor('test-a','upcoming')"),1);
 assert.equal(run("countFor('test-b','active')"),2);
 assert.equal(run("countFor('test-b','new')"),1);
});

test('unavailable source and upcoming guidance remain visible in card bodies',()=>{
 const unavailable=setup([{brandId:'test-a',status:'unavailable'}]);
 const html=unavailable.run('brandCard(brandsData.brands[0],[])');
 assert.match(html,/公式情報の取得に制限があります/);
 assert.match(html,/「フェアなし」とは判断していません/);
 assert.doesNotMatch(html,/[0-9]+件/);
 const upcoming=setup().run('brandCard(brandsData.brands[0],[])');
 assert.match(upcoming,/近日開始のフェアがあります/);
});
