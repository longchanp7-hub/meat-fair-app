/* Rectangular, aspect-preserving image packing. No brand names or campaign counts. */
const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
function leaf(item, index) {
  const ratio = Math.max(.03, Math.min(40, finite(item.ratio, 1)));
  return {type:'leaf', index, kind:item.kind||'campaign', a:1/ratio, b:Math.max(0, finite(item.captionHeight, 52))};
}
function group(type, children, gap) {
  if (children.length === 1) return children[0];
  if (type === 'v') return {type, children, a:children.reduce((s,c)=>s+c.a,0), b:children.reduce((s,c)=>s+c.b,0)+gap*(children.length-1)};
  const inverse = children.reduce((s,c)=>s+1/c.a,0);
  return {type, children, a:1/inverse, b:(children.reduce((s,c)=>s+c.b/c.a,0)-gap*(children.length-1))/inverse};
}
function place(tree, width, gap, x=0, y=0, boxes=[]) {
  const height = tree.a*width+tree.b;
  if (tree.type === 'leaf') boxes.push({index:tree.index, kind:tree.kind, x, y, width, height, imageHeight:height-tree.b});
  else if (tree.type === 'v') {
    for (const child of tree.children) {place(child,width,gap,x,y,boxes); y += child.a*width+child.b+gap;}
  } else {
    for (const child of tree.children) {const w=(height-child.b)/child.a; place(child,w,gap,x,y,boxes); x+=w+gap;}
  }
  return boxes;
}
function cost(tree, width, gap, primary=true) {
  const boxes=place(tree,width,gap);
  if (boxes.some(b=>!Number.isFinite(b.width)||b.width<12||b.imageHeight<12)) return Infinity;
  const minWidth=Math.min(width, width<500?142:174);
  let score=(tree.a*width+tree.b)*.025;
  for(const b of boxes){
    const minHeight=b.kind==='campaign'?(width<500?135:155):(width<500?82:108);
    score += 260*Math.max(0,(minWidth-b.width)/minWidth)**2;
    score += 160*Math.max(0,(minHeight-b.imageHeight)/minHeight)**2;
    score += .02*Math.max(0,b.imageHeight-550);
    if(primary&&b.index===0){
      const goal=Math.min(width, width<500?250:300);
      score += 65*Math.max(0,(goal-b.width)/goal)**2;
      if(b.width<Math.min(width,180)) score+=60;
    }
  }
  return score;
}
function rows(nodes,width,gap,primary=true){
  if(!nodes.length)return null;
  const dp=Array(nodes.length+1);dp[nodes.length]={score:0,groups:[]};
  for(let i=nodes.length-1;i>=0;i--){
    let best;
    for(let n=1;n<=Math.min(width<500?2:3,nodes.length-i);n++){
      const row=group('h',nodes.slice(i,i+n),gap), score=cost(row,width,gap,primary)+dp[i+n].score;
      if(!best||score<best.score)best={score,groups:[row,...dp[i+n].groups]};
    }
    dp[i]=best;
  }
  return group('v',dp[0].groups,gap);
}
function partitions(nodes,gap){
  if(!nodes.length)return [[]];
  const out=[];
  for(let n=1;n<=Math.min(2,nodes.length);n++)for(const tail of partitions(nodes.slice(n),gap))out.push([group('h',nodes.slice(0,n),gap),...tail]);
  return out;
}
export function planGallery(items,width,gap=6){
  width=Math.max(1,finite(width,1));gap=Math.max(0,finite(gap,6));
  if(!items.length)return {height:0,boxes:[],mode:'empty'};
  const nodes=items.map(leaf);
  let best=rows(nodes,width,gap), bestCost=cost(best,width,gap), mode='rows';
  // Try a dominant lead image beside compact rows/columns. All candidates retain
  // semantic order: main, secondary food, then related menus. No empty cells.
  if(items.length>=3){
    for(let n=2;n<=Math.min(6,nodes.length-1);n++)for(const parts of partitions(nodes.slice(1,n+1),gap)){
      const feature=group('h',[nodes[0],group('v',parts,gap)],gap);
      const rest=rows(nodes.slice(n+1),width,gap,false);
      const candidate=rest?group('v',[feature,rest],gap):feature;
      const score=cost(candidate,width,gap);
      if(score<bestCost){best=candidate;bestCost=score;mode='feature';}
    }
  }
  const boxes=place(best,width,gap).sort((a,b)=>a.index-b.index);
  return {height:best.a*width+best.b,boxes,mode};
}
