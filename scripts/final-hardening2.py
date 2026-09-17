from pathlib import Path

root=Path('.')
p=root/'scripts/catalog-extract.mjs'
s=p.read_text()
old="if(brand.id==='gyukaku'&&t.pathname==='/lunch_course/')return false;"
new="if(brand.id==='gyukaku'&&['/lunch_course/','/lunch_teisyoku/'].includes(t.pathname))return false;"
if old not in s: raise SystemExit('Gyukaku exclusion target missing')
s=s.replace(old,new)
old="if(brand.id==='washoku-sato'&&t.pathname.startsWith('/sato/assets/menu/book/'))return false;"
new=old+"\n    if(brand.id==='syabuyo'&&/^\\/syabuyo\\/menu\\/?$/.test(t.pathname))return false;"
s=s.replace(old,new)
old="""  }).map(l=>{
    const u=new URL(l.url);
    // Skylark advertises this menu URL without a trailing slash, and the server
    // briefly redirects through HTTP. Canonicalize locally rather than weakening
    // the HTTPS redirect guard used by the fetcher.
    if(brand.id==='syabuyo'&&u.hostname==='www.skylark.co.jp'&&u.pathname==='/syabuyo/menu')u.pathname='/syabuyo/menu/';
    const url=u.href;
    return{url,title:l.title,rank:DRINK.test(l.title)||/drink|nomihodai/.test(url)?0:/コース|食べ放題|料金|price|course/.test(l.title+url)?1:2};
  }).sort((a,b)=>a.rank-b.rank);"""
new="""  }).map(l=>({url:l.url,title:l.title,rank:DRINK.test(l.title)||/drink|nomihodai/.test(l.url)?0:/コース|食べ放題|料金|price|course/.test(l.title+l.url)?1:2})).sort((a,b)=>a.rank-b.rank);"""
if old not in s: raise SystemExit('Skylark canonicalization target missing')
p.write_text(s.replace(old,new))

p=root/'tests/pipeline-hardening.test.mjs'
s=p.read_text()
old="""  const gyukaku={id:'gyukaku',homeUrl:'https://www.gyukaku.ne.jp/'};
  assert.deepEqual(discoverCatalogLinks('<a href=\"/lunch_course/\">ランチコース</a>','https://www.gyukaku.ne.jp/',gyukaku),[]);
  const sato={id:'washoku-sato',homeUrl:'https://sato-res.com/sato/'};
  assert.deepEqual(discoverCatalogLinks('<a href=\"/sato/assets/menu/book/ayce-260616/\">食べ放題メニュー</a>','https://sato-res.com/sato/',sato),[]);
  const shabuyo={id:'syabuyo',homeUrl:'https://www.skylark.co.jp/syabuyo/'};
  const found=discoverCatalogLinks('<a href=\"/syabuyo/menu\">メニュー</a><a href=\"/syabuyo/menu/yoyaku/\">予約する</a>','https://www.skylark.co.jp/syabuyo/',shabuyo);
  assert.equal(found.length,1);
  assert.equal(found[0].url,'https://www.skylark.co.jp/syabuyo/menu/');"""
new="""  const gyukaku={id:'gyukaku',homeUrl:'https://www.gyukaku.ne.jp/'};
  assert.deepEqual(discoverCatalogLinks('<a href=\"/lunch_course/\">ランチコース</a><a href=\"/lunch_teisyoku/\">ランチ定食</a>','https://www.gyukaku.ne.jp/',gyukaku),[]);
  const sato={id:'washoku-sato',homeUrl:'https://sato-res.com/sato/'};
  assert.deepEqual(discoverCatalogLinks('<a href=\"/sato/assets/menu/book/ayce-260616/\">食べ放題メニュー</a>','https://sato-res.com/sato/',sato),[]);
  const shabuyo={id:'syabuyo',homeUrl:'https://www.skylark.co.jp/syabuyo/'};
  const found=discoverCatalogLinks('<a href=\"/syabuyo/menu\">メニュー</a><a href=\"/syabuyo/menu/\">メニュー</a><a href=\"/syabuyo/menu/yoyaku/\">予約する</a><a href=\"/syabuyo/menu/lunch.html\">平日ランチ</a>','https://www.skylark.co.jp/syabuyo/',shabuyo);
  assert.equal(found.length,1);
  assert.equal(found[0].url,'https://www.skylark.co.jp/syabuyo/menu/lunch.html');"""
if old not in s: raise SystemExit('pipeline test target missing')
p.write_text(s.replace(old,new))

for q in [root/'.github/workflows/final-hardening2-temp.yml',root/'scripts/final-hardening2.py']:
    if q.exists(): q.unlink()
