import test from 'node:test';
import assert from 'node:assert/strict';
import {priceEvidence,comparisonContext,extractCatalogPage,discoverCatalogLinks,dedupCatalog} from '../scripts/catalog-extract.mjs';
const brand={id:'test',name:'公式テスト店',homeUrl:'https://example.com/brand/'};
const doc=s=>`<html><body><main>${s}<p>料金と提供内容は店舗によって異なります。公式掲載の条件を確認してください。</p></main></body></html>`;
test('catalog: explicitly tax-inclusive prices only, no tax arithmetic or ambiguous minimum',()=>{
  assert.equal(priceEvidence('食べ放題 大人 3,000円（税込3,300円）').amount,3300);
  assert.equal(priceEvidence('税込 3,718円〜').from,true);
  assert.equal(priceEvidence('3,718円（税込）').amount,3718);
  assert.equal(priceEvidence('料金 3,000円（税別）').amount,null);
  assert.equal(priceEvidence('大人 税込3300円 子供 税込1650円').amount,null);
});
test('catalog: lunch/dinner, child/adult and add-ons have distinct comparison contexts',()=>{
  assert.notDeepEqual(comparisonContext('大人 平日ランチ'),comparisonContext('小学生 土日ディナー'));
  assert.equal(comparisonContext('コースへ追加1100円').charge,'追加料金');
});
test('catalog: actual HTML images and neighboring course prices are scoped, with independent source evidence',()=>{
  const html=doc('<section><h3>スタンダードコース</h3><p>大人 平日ディナー 税込3,300円</p><img src="/menu/standard.jpg" width="800" height="600" alt="スタンダードコース"></section><section><h3>プレミアムコース</h3><p>大人 平日ディナー 税込4,400円</p><img src="/menu/premium.jpg" width="800" height="600" alt="プレミアムコース"></section>');
  const {items}=extractCatalogPage(html,'https://example.com/brand/menu/',brand);
  assert.equal(items.length,2);assert.deepEqual(items.map(e=>e.price.amount),[3300,4400]);
  assert.ok(items.every(e=>e.campaignId===null&&e.sourceHash&&e.evidenceHash));
  assert.equal(items[0].imageUrl,'https://example.com/menu/standard.jpg');
});
test('catalog: drink plans survive even with unknown image-only prices; do not infer a drink plan from a drink URL',()=>{
  const {items}=extractCatalogPage(doc('<p>ソフトドリンク飲み放題は全員同一プランでのご注文が必要です。</p>'),'https://example.com/brand/menu/',brand);
  assert.equal(items.filter(e=>e.kind==='drink').length,1);assert.equal(items[0].price.amount,null);
  assert.equal(extractCatalogPage(doc('<p>コーヒーとお茶をご用意しています。</p>'),'https://example.com/brand/drink/',brand).items.length,0);
});
test('catalog: discount event pictures are not silently converted into permanent courses',()=>{
  const {items}=extractCatalogPage(doc('<section><h3>9月1日限定 食べ放題キャンペーン</h3><img src="/event.jpg" alt="期間限定フェア" width="800" height="600"></section>'),'https://example.com/brand/',brand);
  assert.equal(items.length,0);
});
test('catalog: high-value dishes do not imply a highest-course exclusive',()=>{
  const {items}=extractCatalogPage(doc('<section><h3>骨付きカルビ</h3><p>スタンダードコース と プレミアムコース で提供しています。</p><img src="/karubi.jpg" width="800" height="600" alt="骨付きカルビ"></section>'),'https://example.com/brand/menu/',brand);
  assert.equal(items.length,1);assert.equal(items[0].kind,'highlight');assert.equal(items[0].exclusive,false);
});
test('catalog: unsafe, cross-brand and fabricated URLs cannot enter menu discovery',()=>{
  const result=discoverCatalogLinks(doc('<a href="/brand/menu/">食べ放題コース</a><a href="https://unrelated.example/menu/">コース</a><a href="/other-brand/menu/">コース</a><a href="http://127.0.0.1/price/">料金</a><a href="/brand/news/old/">古いコース</a>'),'https://example.com/brand/',brand);
  assert.deepEqual(result.map(e=>e.url),['https://example.com/brand/menu/']);
});
test('catalog: challenges and unreadable pages fail closed, not confirmed empty',()=>{
  assert.throws(()=>extractCatalogPage('Access denied','https://example.com/brand/',brand));
});
