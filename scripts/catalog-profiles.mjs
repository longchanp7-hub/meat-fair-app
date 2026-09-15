// Source-specific DOM adapters describe official menu semantics only. They do
// not contain prices, generated image URLs, layout coordinates or item limits.
import {all,one,text,markup,links} from './html-document.mjs';
const normal=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const COURSE=/食べ放題|コース|ビュッフェ|バイキング|サラダバー|(?<!ク)ランチ(?!ャ)|ディナー/;
const DRINK=/飲み放題|ドリンクバー|フリードリンク|さとカフェ|さとバル/;
const STAR=/厚切り.*タン|牛タン|牛たん|黒毛和牛|黒毛牛|骨付き|特選|名物|ずわい|ズワイ|大とろ|中とろ|いくら|大海老|大ホタテ|ローストビーフ|のどぐろ|黒豚|国産牛/;
const tax=s=>/税込\s*[:：]?\s*[¥￥]?\s*\d|\d[\d,]*\s*円?\s*[（(]税込/.test(normal(s));
const up=(n,p,stop)=>{for(;n&&n!==stop;n=n.parent)if(p(n))return n;return null;};
const nearby=(n,max=1400)=>{let last=n;for(let k=0;n&&k<5;k++,n=n.parent){if(text(n).length>max)break;last=n;if(tax(text(n)))return n;}return last;};
const ownTitle=s=>normal(s).replace(/^[●・]+\s*/,'').replace(/\s*\d[\d,]*\s*円[\s\S]*$/,'').trim();
export function profileCatalog(brand,root,url,{photos,campaign=null}={}){
  const out=[],p=new URL(url).pathname,whole=text(root);
  const photo=n=>photos(n||root,url)[0]||null;
  function add(title,node,{kind='course',image=null,priceNode=node,priceText,conditions='',courses=[],exclusive=false,subBrand='',group=null,rank=0,...extra}={}){
    title=ownTitle(title);if(/^(?:九州黒豚|黒毛和牛).*食べ放題/.test(title))title=title.split(/[¥￥]/)[0].trim();if(!title||title.length>80)return;
    const evidence=[text(node),conditions,image?.imageUrl?'公式HTML画像 '+image.imageUrl:null].filter(Boolean).join(' ');
    out.push({title,node,evidence,kind,image,priceEvidence:priceText??text(priceNode),conditions,courses,exclusive,subBrand,comparisonGroup:group,rank,...extra});
  }
  function drinks(scope=root){
    for(const h of all(scope,'h2,h3,h4,dt')){
      const title=normal(text(h));if(!DRINK.test(title)||title.length>75||/付き|飲み放題はこちら|延長/.test(title))continue;
      const n=nearby(h,1300);
      if(tax(text(n))&&!/食べ放題.*コース/.test(text(n)))add(title,n,{kind:'drink',image:photo(n),group:url+'|drinks'});
    }
  }
  function dishes(scope,coursename,{exclusive=false}={}){
    const seen=new Set();
    for(const img of photos(scope,url,{allowSmall:true})){
      const name=normal(img.title);
      if(!STAR.test(name)||name.length>55||COURSE.test(name)||/[¥￥円]|店舗|税込/.test(name))continue;
      if(seen.has(name))continue;seen.add(name);
      add(name,img.node.parent,{kind:'highlight',image:img,priceText:'',courses:[coursename],exclusive,conditions:`公式掲載コース：${coursename}`,rank:exclusive?0:10});
    }
    for(const img of photos(scope,url,{allowSmall:true})){
      if(img.title)continue;
      for(let n=img.node.parent,depth=0;n&&n!==scope&&depth<4;n=n.parent,depth++){
        const names=all(n,'h3,h4,h5,p,li').map(text).map(normal).filter(t=>STAR.test(t)&&t.length<55&&!COURSE.test(t)&&!/[¥￥円]|店舗|税込|提供|限定|※/.test(t));
        if(photos(n,url,{allowSmall:true}).length!==1)break;
        const own=normal(text(n));if(STAR.test(own)&&own.length<55&&!COURSE.test(own)&&!/[¥￥円]|店舗|税込|提供|限定|※/.test(own))names.push(own);
        if(new Set(names).size===1){const name=names[0];if(!seen.has(name)){seen.add(name);add(name,n,{kind:'highlight',image:img,priceText:'',courses:[coursename],exclusive,conditions:`公式掲載コース：${coursename}`,rank:exclusive?0:10});}break;}
      }
    }
    for(const h of all(scope,'h5,.p-courseName')){
      const name=normal(text(h));if(!STAR.test(name)||name.length>55||seen.has(name))continue;seen.add(name);
      const box=up(h,n=>/p-menuCard(?:\s|$)/.test(n.attrs?.class||''),scope)||h.parent?.parent;
      add(name,box||h,{kind:'highlight',image:photo(box),priceText:'',courses:[coursename],exclusive,conditions:`公式掲載コース：${coursename}`,rank:exclusive?0:10});
    }
  }
  // Campaign data is scoped by the caller; it cannot contribute sidebar news.
  if(campaign){
    for(const img of photos(root,url)){
      const title=normal(img.title);
      if(COURSE.test(title)&&tax(title)&&title.length<180&&!/以上をご注文|追加料金|だし|タレ|お子様|土・日|フェス|キャンペーン/.test(title))add(title,img.node,{image:img,priceText:title,group:url+'|campaign-courses'});
    }
    if(brand.id==='roan'){
      if(campaign.priceText&&campaign.targetCourses?.length){
        const name=campaign.targetCourses.join('／');
        const pnode=one(root,'p')||root;
        add(name,pnode,{priceText:campaign.priceText,conditions:[campaign.priceText,...(campaign.conditions||[])].join(' '),group:url,evidence:[campaign.priceText,text(root)].join(' ')});
      }
      for(const n of all(root,'p')){
        const t=normal(text(n));if(t.length<500&&/ドリンクバー無料/.test(t))add('ドリンクバー',n,{kind:'drink',priceText:'',freeText:'食事に含まれるドリンクバー（公式に無料の記載）'});
      }
    }
    return out;
  }
  switch(brand.id){
    case 'yakiniku-king': {
      if(/\/menu_all\/(?:free\d+|lunch)\/?$/.test(p)){
        const h=one(root,'.c-pageHeader--heading'),n=one(root,'.c-pageHeader--detail');
        if(h&&n&&tax(text(n))){
          const name=text(h);add(name,n,{image:photo(one(root,'.c-pageHeader--visual')),priceNode:one(n,'.c-pageHeader--price')||n,conditions:text(one(root,'.c-articleHeader')),group:'king-main-course'});
          for(const dish of all(root,'.p-menuCard')){const heading=one(dish,'.p-courseName');if(!heading||!/^【名物】|黒毛|特選/.test(text(heading)))continue;const exclusive=/(?:^|\s)-premium(?:\s|$)/.test(heading.attrs.class||'')&&/でしか|だけ|限定/.test(text(one(root,'.c-pageHeader--description')));dishes(dish,name,{exclusive});}
        }
      }else if(/\/drink\/?$/.test(p))drinks(one(root,'#drinkMenu')||root);
      return out;
    }
    case 'gyukaku': {
      if(/\/menu\/[^/]*course\.php$/.test(p)){
        const h=all(root,'h2').find(n=>/コース/.test(text(n))&&text(n).length<55);
        if(h){const n=nearby(h,1200),name=text(h);if(tax(text(n))){add(name,n,{image:photo(n.parent),group:'gyukaku-main-course',conditions:'店舗によりメニュー・料金が異なる場合があります。'});dishes(root,name);}}
      }else if(/\/menu\/menu-drink\.php$/.test(p))drinks(one(root,'#nomiho-top')||root);
      return out;
    }
    case 'syabuyo': {
      if(p==='/syabuyo/'){
        for(const img of photos(root,url)){
          const t=normal(img.title);
          if(/宴会コース|60分|豚肉2皿/.test(t)&&!/(?:学生|京都|奈良|銀座|心斎橋)/.test(t))add(t,img.node.parent,{image:img,priceText:t,group:url,kind:'course'});
        }
      }else if(/\/menu\/(?:lunch|dinner)\.html$/.test(p)||/menu_detail/.test(p)){
        for(const n of all(root,'.mod-menu-item,.menu-item,.product,.item')){
          const h=one(n,'h2,h3,h4,.name,.title');if(!h||!COURSE.test(text(h)))continue;
          add(text(h),n,{image:photo(n),group:url});
        }
        drinks();
      }else if(/\/menu\/enkai\/?$/.test(p)){
        const img=photos(root,url).find(i=>/しゃぶしゃぶ寿司コース/.test(i.title));if(img)add(img.title,img.node.parent,{image:img,priceText:'',conditions:'平日ディナー・事前予約などの条件は公式案内でご確認ください。'});
        if(/飲み放題/.test(whole))add('宴会コースの飲み放題',root,{kind:'drink',priceText:'',conditions:'飲み放題を含む宴会プランです。コース料金・予約条件は公式案内で確認してください。'});
      }
      return out;
    }
    case 'yuzuan': {
      if(/\/menu\/(?:course\/[^/]+|lunch\/tabehodai)\/?$/.test(p)){
        const h=all(root,'h1').find(n=>COURSE.test(text(n))&&text(n).length<60);
        if(h){const n=nearby(h,1500),name=text(h);if(tax(text(n))){add(name,n,{image:photo(n.parent?.parent),conditions:text(n.parent),group:/lunch/.test(p)?'yuzuan-lunch':'yuzuan-course'});}
          for(const heading of all(root,'.yuzuan-product-section-title'))if(/コース限定/.test(text(heading)))dishes(heading.parent,name,{exclusive:true});
        }
      }else if(/\/menu\/drink\/?$/.test(p)){
        for(const n of all(root,'.wp-block-lazyblock-nomihodai-abstract')){
          const h=one(n,'h2');if(!h)continue;const name=normal(text(h)),t=normal(text(n));
          if(/15:00まで/.test(t)&&/通常料金/.test(t)){
            const first=t.match(/15:00まで[\s\S]*?(?:税込\s*[\d,]+\s*円)[）)]/),second=t.match(/通常料金[\s\S]*?(?:税込\s*[\d,]+\s*円)[）)]/);
            if(first)add(name+'（15:00まで）',n,{kind:'drink',priceText:first[0],group:url+'|lunch-drinks'});
            if(second)add(name+'（通常料金）',n,{kind:'drink',priceText:second[0],group:url+'|regular-drinks'});
          }else add(name,n,{kind:'drink',group:url+'|drinks'});
        }
      }
      return out;
    }
    case 'amiyakitei': {
      if(!/\/menu\/?$/.test(p))return out;
      for(const scope of all(root,'.brand-content')){
        const isPlus=!!one(scope,'#course-plus'),subBrand=isPlus?'あみやき亭Plus':'あみやき亭';
        for(const n of all(scope,'.course-slider__item')){
          const h=one(n,'.course-slider__title');if(h&&tax(text(n)))add(text(h),n,{image:photo(n),subBrand,group:subBrand+'|course'});
        }
        for(const h of all(scope,'.drink-title-wrapper'))if(DRINK.test(text(h))){
          const n=nearby(h,1800);add('飲み放題',n,{kind:'drink',image:photo(n),subBrand,group:subBrand+'|drink',conditions:'コースにつけられる飲み放題です。'});
        }
      }
      return out;
    }
    case 'jukusei-ichiban': {
      if(p==='/jp/'){
        // Only the official main slider images that link directly to the current
        // regular menu. Their artwork supplies the visual dish/course details.
        let index=0;
        for(const link of links(root,url))if(/\/jp\/menu\/(?:index\.html)?$/.test(link.url)){
          const img=photo(link.node);if(!img||!/mainVisual/.test(img.imageUrl)||img.title)continue;
          add('グランドメニューの注目料理 '+(++index),link.node,{kind:'highlight',image:img,priceText:'',conditions:'料理名と対象コースは公式画像の表記をご確認ください。',rank:20});
        }
        return out;
      }
      if(!/\/jp\/menu\/?$/.test(p))return out;
      for(const h of all(root,'.productName,.productName2')){
        const name=text(h);if(!COURSE.test(name)&&!DRINK.test(name))continue;
        const n=up(h,n=>(n.attrs?.class||'').split(/\s+/).includes('box'),root)||nearby(h,900);
        if(!tax(text(n)))continue;
        const link=up(h,n=>n.tag==='a'&&/^#/.test(n.attrs?.href||''),root);
        const target=link&&one(root,link.attrs.href.replace('#tab','#cate')),image=target?photo(target):photo(n);
        const kind=DRINK.test(name)?'drink':'course';
        add(name,n,{kind,image,group:kind==='course'?'ichiban-normal-course':'ichiban-drinks',conditions:'通常店の掲載メニュー。100分、ラストオーダー20分前。店舗により内容・料金が異なる場合があります。'});
      }
      return out;
    }
    case 'anrakutei': {
      if(/\/menucate\/tabehoudai\/?$/.test(p)){
        for(const h of all(root,'h3'))if(/コース/.test(text(h))&&tax(text(h))){
          const n=up(h,n=>n.tag==='section',root)||h.parent;add(text(h),n,{priceNode:h,image:photo(n),group:'anrakutei-course'});
          dishes(n,ownTitle(text(h)));
        }
      }else if(/\/menucate\/drink\/?$/.test(p)){
        for(const h of all(root,'h3'))if(DRINK.test(text(h))){const n=up(h,x=>x.tag==='section',root)||h.parent;add(text(h),n,{kind:'drink',image:photo(n),priceText:'',group:url+'|drinks'});}
        for(const n of all(root,'li')){const h=one(n,'.title');if(!h||!DRINK.test(text(h)))continue;const price=one(n,'.price');add(text(h),n,{kind:'drink',image:photo(n),priceText:text(price),group:url+'|drinks'});}
        for(const img of photos(root,url))if(DRINK.test(img.title))add(img.title,img.node.parent,{kind:'drink',image:img,priceText:'',group:url+'|drinks'});
        drinks();
        if(!out.length){const scope=one(root,'.tabDetail,.contentsWrapPartsC02,#contentsArea')||root;const img=photos(scope,url).find(i=>/drink|nomi|bar/i.test(i.imageUrl));if(img)add('ドリンクメニュー・料金表',scope,{kind:'drink',image:img,priceText:'',planExistence:'menu_only'});}
      }
      return out;
    }
    case 'onyasai': {
      if(/\/menu\/menu-tabehoudai-[^/]+\.php$/.test(p)){
        const h=all(root,'h3').find(n=>/コース/.test(text(n))&&tax(text(nearby(n,1000))));
        if(h){const n=nearby(h,1000);add(text(h),n,{image:photo(n.parent),group:'onyasai-main-course'});dishes(root,ownTitle(text(h)));}
      }else if(/\/menu\/menu-drink(?:_n)?\.php\/?$/.test(p)){
        const h=all(root,'h3').find(n=>/飲み放題/.test(text(n)));
        if(h){const scope=h.parent?.parent?.parent||root;
          for(const n of all(scope,'div')){const t=normal(text(n));if(!/^(?:ビールも 飲める )?(?:アルコール|ソフトドリンク)飲み放題/.test(t)||t.length>350||!tax(t))continue;
            if(all(n,'div').some(x=>x!==n&&/^(?:ビールも 飲める )?(?:アルコール|ソフトドリンク)飲み放題/.test(normal(text(x)))&&tax(text(x))))continue;
            const name=t.includes('アルコール飲み放題')?'アルコール飲み放題':'ソフトドリンク飲み放題';
            add(name,n,{kind:'drink',priceText:t.split('小学生')[0],group:url+'|drinks',conditions:text(h)});
          }
          if(!out.length)add(text(h),scope,{kind:'drink',priceText:'',image:photo(scope)});
        }
      }
      return out;
    }
    case 'nikusho-sakai': {
      if(!/\/(?:menu|drink)\/?$/.test(p))return out;
      // Japanese names are read from *observed* official image descriptions or
      // filenames. Filename numbers are never interpreted as tax-inclusive prices.
      for(const img of photos(root,url)){
        const raw=decodeURIComponent(new URL(img.imageUrl).pathname).normalize('NFKC'),name=img.title;
        if(/飲み放題/.test(name+raw)&&!/特急レーン/.test(raw))add('飲み放題メニュー',img.node.parent,{kind:'drink',image:img,priceText:'',group:url});
        else if(/コース/.test(raw)&&/表面/.test(raw)){
          const m=raw.match(/(お手軽コース|肉匠坂井ライトコース|肉匠坂井スペシャルコース|贅沢プレミアムコース)/);
          if(m)add(m[1],img.node.parent,{image:img,priceText:'',group:url,conditions:'公式コース一覧画像の料金・対象品目をご確認ください。店舗限定メニューは別設定です。'});
        }
      }
      return out;
    }
    case 'kalubi-taisho': {
      if(!/\/menu\/\d+\/?$/.test(p))return out;
      const scope=one(root,'.menuItem');if(!scope)return out;
      if(/愛知|岐阜|三重/.test(text(scope))&&/実施しておりません|実施していません|販売しておりません/.test(text(scope)))return out;
      const heading=one(root,'.mainTxt_title'),title=normal(text(heading));
      for(const n of all(scope,'.item_txt')){
        const lines=(n.children||[]).reduce((a,x)=>{if(x.tag==='br')a.push('');else a[a.length-1]+=text(x)+' ';return a;},['']).map(normal);
        for(const line of lines)if(/コース/.test(line)&&tax(line)&&line.length<150){
          const name=line.replace(/\s*\d+品以上.*$/,'').replace(/\s*\d[\d,]*円.*$/,'');
          add(name,n,{image:photo(scope),priceText:line,group:url,conditions:normal(lines.filter(l=>/^※/.test(l)).join(' ')),evidence:line+' '+text(n)});
        }
      }
      if(!out.length&&/ドリンク/.test(title))add(title.replace(/menu$/i,''),scope,{kind:'drink',image:photo(scope),priceText:'',group:url,planExistence:'menu_only'});
      else if(!out.length&&/食べ放題コース/.test(title))add(title.replace(/menu$/i,''),scope,{image:photo(scope),priceText:'',group:url});
      return out;
    }
    case 'washoku-sato': {
      if(/\/sato\/menu\/?$/.test(p)){
        for(const link of links(root,url)){
          if(!/\/menu\/book\//.test(link.url)||!/食べ放題|ランチメニュー|宴席メニュー/.test(link.title))continue;
          add(link.title,link.node,{image:photo(link.node),priceText:'',officialUrl:link.url,group:url});
        }
      }
      // The site's own "さとカフェ＆さとバル" banner is explicit drink-plan
      // evidence, unlike a generic "ドリンク" link. Prices may be image-only.
      if(p==='/sato/')for(const img of photos(root,url))if(/さとカフェ|さとバル/.test(img.title))add(img.title,img.node,{kind:'drink',image:img,priceText:'',group:url});
      return out;
    }
    case 'stamina-taro': {
      if(/\/menu\/?$/.test(p)){
        for(const h of all(root,'h2,h3,h4,.menu-toggle-btn')){const title=normal(text(h));if(/^(?:平日ランチ|ディナー.*ランチ)$/.test(title))add(title+' 食べ放題',h,{priceText:'',conditions:'店舗別の食べ放題料金は公式店舗ページで確認してください。',group:url+'|'+title});}
        dishes(root,'公式食べ放題メニュー');
        for(const n of all(root,'.menu-card').flatMap(card=>all(card,'p'))){
          const t=normal(text(n)),name=t.split('※')[0].trim();
          if(!/^(?:牛タン|中落カルビ)$/.test(name))continue;
          const limited=/(?:^|\s)m-yasumi(?:\s|$)/.test(n.attrs.class||'');
          add(name,n,{kind:'highlight',priceText:'',courses:[/※ディナー限定/.test(t)?'ディナー限定':limited?'ディナー・土日祝ランチ':'公式食べ放題メニュー'],conditions:text(n),exclusive:false});
        }
        for(const n of all(root,'p,h2,h3,div')){
          const t=normal(text(n));if(t.length>220||!DRINK.test(t)||!tax(t)||all(n,'div,p,h2,h3').some(c=>c!==n&&DRINK.test(text(c))&&tax(text(c))))continue;
          add('ソフトドリンクバー',n,{kind:'drink',priceNode:n,group:url,conditions:'食事とは別売。店舗ごとの料金・提供状況を確認してください。'});
        }
      }
      return out;
    }
    case 'asakuma': {
      if(/\/salad-bar\/?$/.test(p)){
        const h=all(root,'h1,h2,h3').find(n=>/食べ放題サラダバー/.test(text(n)));
        if(h)add(text(h),h,{priceText:'',image:photos(root,url).find(i=>/サラダバー/.test(i.title))||null,conditions:'メイン料理の食べ放題ではありません。サラダバーのない店舗もあります。'});
        for(const img of photos(root,url))if(/コーンスープ|カレーライス/.test(img.title))add(img.title,img.node,{kind:'highlight',image:img,priceText:'',conditions:'公式サラダバー掲載メニュー。店舗により提供内容が異なります。'});
      }else if(/menu_recommended-lunch-menu(?:_without-sb)?\.html$/.test(p)){
        const h=all(root,'h1,h2,h3').find(n=>/ランチ/.test(text(n))),pageName=text(h),shopList=text(one(root,'#shop'));
        for(const box of all(root,'.box_menu')){
          const name=text(one(box,'.ttl_menu')),priced=all(box,'p').find(n=>tax(text(n)));
          if(!name||!priced)continue;
          add(name+'（平日ランチ）',box,{image:photo(box),priceNode:priced,group:url+'|weekday-lunch',conditions:pageName+'。'+shopList+'。メイン料理の食べ放題ではありません。サラダバー別料金の店舗は、別料金用の公式メニューを確認してください。'});
        }
        if(!out.length&&h)add(pageName,h,{priceText:'',conditions:'平日ランチの公式メニュー。メイン料理とサラダバーの提供範囲を確認してください。'});
      }else if(/\/menu\/(?:lunchmenu|grandmenu)-[^/]+\.html$/.test(p)){
        const h=one(root,'h1'),shops=text(one(root,'.menu_shoplist_style'));
        // Real menu boards contain the drink/salad-bar options even when those
        // prices are image-only. Do not assert that every main dish includes them.
        for(const img of photos(root,url))if(/ランチメニュー|人気セレクト|グランドメニュー/.test(img.title))add(img.title,img.node,{image:img,priceText:'',conditions:shops,group:url});
      }
      return out;
    }
    case 'roan': return null; // Explicit official linked pages / current blog scope.
    case 'kushiya-monogatari': {
      if(/\/(?:qa|about)\/?$/.test(p)){
        if(/ソフトドリンク.*飲み放題/.test(whole))add('ソフトドリンク飲み放題',root,{kind:'drink',priceText:'',conditions:whole.slice(0,2500)});
        if(/アルコール.*飲み放題/.test(whole))add('アルコール飲み放題（店舗限定）',root,{kind:'drink',priceText:'',conditions:whole.slice(0,2500)});
        if(/食べ放題/.test(whole))add('串揚げ食べ放題',root,{image:photos(root,url).find(i=>/串/.test(i.title))||null,priceText:'',conditions:'料金・制限時間は利用店舗の公式案内で確認してください。'});
      }
      return out;
    }
    default:return null;
  }
}
