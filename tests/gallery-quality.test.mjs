import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHtml} from '../scripts/html-document.mjs';
import {detailAssets,menuAssets} from '../scripts/gallery-extract.mjs';
const base='https://official.example/';
test('banquet reservations are food information, not a generic booking advertisement',()=>{
 const html='<main><a href="/menu/enkai/"><img src="banquet.jpg" alt="【平日ディナー限定】宴会コース"><p>宴会コースご予約承ります。</p></a><a href="/booking/"><img src="booking.jpg" alt="お席のご予約承ります"></a></main>';
 const rows=menuAssets(html,base);assert.equal(rows.length,1);assert.match(rows[0].title,/宴会/);
});
test('dated and regional news are never relabelled as an evergreen local menu',()=>{
 const html='<main><a href="/topic/august/"><img src="old.jpg" alt="8/21～31 肉の日祭り 食べ放題コース最大20%OFF"></a><a href="/menu/bara/"><img src="west.jpg" alt="豚バラ食べ放題コース 京都府＆奈良県限定"></a><a href="/menu/lunch/"><img src="lunch.jpg" alt="豚2皿ランチ"></a></main>';
 const rows=menuAssets(html,base);assert.equal(rows.length,1);assert.match(rows[0].title,/2皿/);
});
test('an upcoming linked promotion and non-food decorations cannot become current-fair details',()=>{
 const scope=parseHtml('<main><a href="/future/"><img src="future.jpg" alt="9月16日から 鴨しゃぶ食べ放題"></a><img src="wall.jpg" alt="フェア限定 壁紙ダウンロード"><img src="coupon.jpg" alt="食べ放題クーポン QR スクリーンショット"><img src="beef.jpg" alt="黒毛和牛 食べ放題 ￥3,399"><img src="stock.jpg" alt="ポルチーニ鶏だし"></main>');
 const rows=detailAssets(scope,base,{id:'c',contentHash:'h'});assert.equal(rows.length,2);assert.equal(rows[0].rank,20);assert.equal(rows[1].rank,30);
 const menus=menuAssets('<main><a href="/lunch/"><img src="lunch.jpg" alt="牛肉ランチ"></a></main>',base);
 assert.ok(rows.every(row=>row.rank<menus[0].rank),'fair food must be ordered before related lunch menus');
});
