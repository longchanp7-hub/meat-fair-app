// Small, non-executing HTML tree for scoped extraction. Not a browser/JavaScript evaluator.
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
export function decode(s = '') {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (m, x) => {
    if (x[0] === '#') { const n = x[1].toLowerCase() === 'x' ? parseInt(x.slice(2),16) : Number(x.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '})[x.toLowerCase()] ?? m;
  });
}
export function parseHtml(input = '') {
  const html = input.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const root = {tag:'document',attrs:{},children:[],start:0,end:html.length,html};
  const stack=[root];
  for (const m of html.matchAll(/<\/?[a-zA-Z][^>]*>|[^<]+/g)) {
    const token=m[0];
    if (!token.startsWith('<')) {stack.at(-1).children.push({tag:'#text',value:decode(token)});continue;}
    const match=token.match(/^<(\/?)([\w:-]+)/); if(!match)continue;
    const tag=match[2].toLowerCase();
    if(match[1]) {const at=stack.findLastIndex(n=>n.tag===tag);if(at>0){for(const n of stack.splice(at))n.end=m.index+token.length;}continue;}
    const attrs={};const raw=token.slice(match[0].length,-1);
    for (const a of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()]=decode(a[2]??a[3]??a[4]??'');
    const node={tag,attrs,children:[],start:m.index,end:m.index+token.length,parent:stack.at(-1),html};
    stack.at(-1).children.push(node);if(!VOID.has(tag)&&!token.endsWith('/>'))stack.push(node);
  }
  for(const n of stack)n.end=html.length;
  return root;
}
export function matches(node, selector) {
  const parts=selector.trim().match(/^[\w-]+|[.#][\w-]+/g)||[];
  return parts.length>0&&parts.every(p=>p[0]==='.'?(node.attrs?.class||'').split(/\s+/).includes(p.slice(1)):p[0]==='#'?node.attrs?.id===p.slice(1):node.tag===p.toLowerCase());
}
export function all(root,selector){const out=[],sels=selector.split(',');function walk(n){if(sels.some(s=>matches(n,s)))out.push(n);for(const c of n.children||[])walk(c)}if(root)walk(root);return out;}
export function one(root,selectors){for(const s of selectors.split(',')){const n=all(root,s)[0];if(n)return n}return null;}
export function text(node){if(!node)return'';if(node.tag==='#text')return node.value;if(node.tag==='img')return node.attrs.alt||'';return(node.children||[]).map(text).join(' ').replace(/\s+/g,' ').trim();}
export function markup(node){return node?.html?.slice(node.start,node.end)||'';}
export function httpUrl(raw,base){try{const u=new URL(decode(raw),base);if(!['http:','https:'].includes(u.protocol))return null;u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_'))u.searchParams.delete(k);u.pathname=u.pathname.replace(/\/+/g,'/').replace(/\/index\.html$/,'/');return u.href}catch{return null}}
export function links(root,base){return all(root,'a').map(n=>({url:httpUrl(n.attrs.href,base),title:text(n),node:n})).filter(x=>x.url)}
