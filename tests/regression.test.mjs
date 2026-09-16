import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHtml,one,text} from '../scripts/html-document.mjs';
import {extractPage,datesFor,parsePeriod,validDate,dedupCampaigns,allowedDetail,discoverLinks,FOOD_TITLE} from '../scripts/site-profiles.mjs';
import {campaignStatus} from '../app/status.mjs';
import {validateDataset} from '../scripts/quality-gate.mjs';
import {SOURCES} from '../scripts/source-registry.mjs';
const brand=id=>SOURCES.find(b=>b.brandId===id);
test('JST transition at midnight regardless of host timezone',()=>{
 const c={startDate:'2026-09-16',endDate:'2026-12-08',lifecycleStatus:'current'};
 assert.equal(campaignStatus(c,new Date('2026-09-15T14:59:59Z')).state,'upcoming');
 assert.equal(campaignStatus(c,new Date('2026-09-15T15:00:00Z')).state,'active');
 assert.equal(campaignStatus({...c,endDate:'2026-09-16'},new Date('2026-09-16T15:00:00Z')).state,'ended');
});
test('known ended campaigns and future firstSeen never become new active',()=>{
 for(const lifecycleStatus of ['ended_official','ended_by_date','stale_unverified'])assert.equal(campaignStatus({lifecycleStatus}).state,'ended');
 assert.equal(campaignStatus({firstSeenAt:'2099-01-01T00:00:00Z'}).isNew,false);
});
test('real calendar validation',()=>{
 assert.equal(validDate('2026-02-31'),false);assert.equal(validDate('2026-13-02'),false);assert.equal(validDate('2028-02-29'),true);
 assert.ok(validateDataset({campaigns:[{id:'x',brandId:'gyukaku',title:'牛タンフェア',officialUrl:'https://www.gyukaku.ne.jp/',startDate:'2026-02-31'}]}).includes('0:start_date_invalid'));
});
test('Japanese range, slash range, same-month end, no invented year',()=>{
 assert.deepEqual(parsePeriod('2026年9月7日(月)〜9月18日(金)',null),{startDate:'2026-09-07',endDate:'2026-09-18',endDateText:null});
 assert.equal(parsePeriod('9月11日(金)〜20日(日)',2026).endDate,'2026-09-20');
 assert.equal(parsePeriod('2026/7/14〜',null).startDate,'2026-07-14');
 assert.equal(parsePeriod('9月9日〜11月1日',null),null);
 assert.equal(parsePeriod('12月25日〜1月10日',2026).endDate,'2027-01-10');
});
test('Sato extracts news article instead of logo/sidebar dates',()=>{
 const p=extractPage(brand('washoku-sato'),'<article>ロゴ 2025年1月1日</article><article class="news"><h3>和食さと 松茸フェア 9月3日〜</h3><p>2026年9月3日</p><img src="food.jpg"></article><aside>2024年1月1日</aside>','https://sato-res.com/news/2026/09/37321.html');
 assert.match(p.bodyText,/松茸/);assert.doesNotMatch(p.bodyText,/2025|2024/);assert.equal(datesFor(p,'https://sato-res.com/news/2026/09/37321.html').startDate,'2026-09-03');
});
test('Sakai ignores neighboring expired campaigns',()=>{
 const p=extractPage(brand('nikusho-sakai'),'<article class="p-entry"><h1 class="p-entry__title">台湾グルメフェア</h1><div class="p-entry__body">販売期間 9月9日〜11月1日 台湾料理食べ放題</div><time datetime="2026-09-02"></time></article><aside>終了しました 2026年7月21日〜7月24日</aside>','https://www.yakiniku.jp/nikushou_sakai/news/taiwan_gourmet/');
 assert.doesNotMatch(p.bodyText,/終了しました/);assert.equal(datesFor(p,'https://www.yakiniku.jp/nikushou_sakai/news/taiwan_gourmet/').endDate,'2026-11-01');
});
test('fair page does not absorb adjacent student offer; ignores commented dates',()=>{
 const p=extractPage(brand('jukusei-ichiban'),'<div class="menuFair_wrap"><dl><h3>秋の焼肉フェア開催中</h3><!--2025年9月1日--><img src="autumn.jpg"></dl><dl><h3>学生専用食べ放題</h3></dl></div>','https://www.jukusei-ichiban.jp/jp/menu/cat5.html');
 assert.doesNotMatch(p.bodyText,/学生|2025/);
});
test('dedup preserves two distinct offers with same start and ingredient',()=>{
 const c={brandId:'washoku-sato',startDate:'2026-09-03',endDate:null,limitedIngredients:['サーモン']};
 const a={...c,title:'松茸料理食べ放題',officialUrl:'https://sato-res.com/a'};
 const b={...c,title:'なごやめしフェア',officialUrl:'https://sato-res.com/b'};
 assert.equal(dedupCampaigns([a,b]).length,2);assert.equal(dedupCampaigns([a,{...a}]).length,1);
});
test('restrict sources to official detail hosts, not feeds/archive/assets',()=>{
 assert.equal(allowedDetail(brand('nikusho-sakai'),'https://www.yakiniku.jp/nikushou_sakai/news/feed/'),false);
 assert.equal(allowedDetail(brand('amiyakitei'),'https://amiyakitei.jp/topics/category/news/'),false);
 assert.equal(allowedDetail(brand('gyukaku'),'https://evil.example/lp/test/'),false);
});
test('Shabuyo campaign index and food-campaign title are discoverable',()=>{
 const b=brand('syabuyo');
 assert.ok(b.sources.some(s=>s.type==='campaign_detail'&&s.url==='https://www.skylark.co.jp/syabuyo/campaign/'));
 assert.equal(allowedDetail(b,'https://www.skylark.co.jp/syabuyo/campaign/'),true);
 assert.equal(allowedDetail(b,'https://www.skylark.co.jp/syabuyo/campaign/silverweek/'),true);
 assert.equal(allowedDetail(b,'https://www.skylark.co.jp/syabuyo/other/'),false);
 assert.equal(FOOD_TITLE.test('シルバーウィークキャンペーン'),true);
 const found=discoverLinks(b,'<a href="/syabuyo/campaign/">シルバーウィークキャンペーン</a>','https://www.skylark.co.jp/syabuyo/');
 assert.equal(found.length,1);assert.equal(found[0].url,'https://www.skylark.co.jp/syabuyo/campaign/');
});
test('current rollout has 14 distinct source definitions and audited imagery',()=>{
 assert.equal(SOURCES.length,14);assert.equal(new Set(SOURCES.map(b=>b.brandId)).size,14);
 const r=JSON.parse(fs.readFileSync(new URL('../scripts/reviewed-campaigns.json',import.meta.url))).reviews;
 assert.equal(new Set(r.map(x=>x.officialUrl)).size,r.length);
 const find=x=>r.find(c=>c.officialUrl.includes(x));
 assert.match(find('tanfair').fields.imageUrl,/ogp\.png$/);
 assert.match(find('2606_hawaii').fields.imageUrl,/king2101_Hawaii/);
 assert.match(find('fair_sep').fields.imageUrl,/pc_01/);
 assert.match(find('7327').fields.imageUrl,/web_sushi/);
 assert.match(find('taiwan_gourmet').fields.imageUrl,/台湾グルメフェア2026.jpg$/);
 assert.match(find('cat5').fields.imageUrl,/autumn/);
});

test('verified news announcement and landing page are one fair in either input order',()=>{
 const landing={brandId:'yakiniku-king',title:'期間限定 韓国市場（カンコクシジャン）',officialUrl:'https://www.yakiniku-king.jp/menu_all/season/2609_koreanfair/',startDate:'2026-09-16',endDate:'2026-12-08',verificationState:'reviewed',imageUrl:'https://example.com/overview.jpg'};
 const news={...landing,title:'2026年9月16日(水)より期間限定フェア「韓国市場(カンコクシジャン)」を開催します。',officialUrl:'https://www.yakiniku-king.jp/news/6811/',endDate:null,verificationState:'automatic',imageUrl:'https://example.com/announcement.jpg'};
 for(const rows of [[landing,news],[news,landing]]){
  const merged=dedupCampaigns(rows);assert.equal(merged.length,1);
  assert.equal(merged[0].officialUrl,landing.officialUrl);
  assert.equal(merged[0].endDate,'2026-12-08');
  assert.equal(merged[0].imageUrl,landing.imageUrl);
  assert.ok(merged[0].secondarySources.some(x=>x.url===news.officialUrl));
 }
 assert.equal(dedupCampaigns([news]).length,0,'missing checked landing page cannot be bypassed');
 assert.equal(dedupCampaigns([{...landing,verificationState:'automatic'},news]).length,1,'changed review cannot be bypassed');
});

test('same seasonal theme in different years is not merged',()=>{
 const a={brandId:'yakiniku-king',title:'韓国フェア',officialUrl:'https://www.yakiniku-king.jp/menu_all/season/2509_koreanfair/',startDate:'2025-09-17',endDate:'2025-12-09'};
 const b={...a,officialUrl:'https://www.yakiniku-king.jp/menu_all/season/2609_koreanfair/',startDate:'2026-09-16',endDate:'2026-12-08'};
 assert.equal(dedupCampaigns([a,b]).length,2);
});
