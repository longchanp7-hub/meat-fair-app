/* Rectangular, aspect-preserving image packing. No brand names or campaign counts. */
const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
function leaf(item, index) {
  const ratio = Math.max(.03, Math.min(40, finite(item.ratio, 1)));
  return {type:'leaf', index, kind:item.kind||'campaign', group:item.group||'', visualWeight:Math.max(1,finite(item.visualWeight,1)), minWidth:Math.max(0,finite(item.minWidth,0)), a:1/ratio, b:Math.max(0, finite(item.captionHeight, 52))};
}
function group(type, children, gap) {
  if (children.length === 1) return children[0];
  if (type === 'v') return {type, children, a:children.reduce((s,c)=>s+c.a,0), b:children.reduce((s,c)=>s+c.b,0)+gap*(children.length-1)};
  const inverse = children.reduce((s,c)=>s+1/c.a,0);
  return {type, children, a:1/inverse, b:(children.reduce((s,c)=>s+c.b/c.a,0)-gap*(children.length-1))/inverse};
}
function place(tree, width, gap, x=0, y=0, boxes=[]) {
  const height = tree.a*width+tree.b;
  if (tree.type === 'leaf') boxes.push({index:tree.index, kind:tree.kind, visualWeight:tree.visualWeight, minWidth:tree.minWidth, x, y, width, height, imageHeight:height-tree.b});
  else if (tree.type === 'v') {
    for (const child of tree.children) {place(child,width,gap,x,y,boxes); y += child.a*width+child.b+gap;}
  } else {
    for (const child of tree.children) {const w=(height-child.b)/child.a; place(child,w,gap,x,y,boxes); x+=w+gap;}
  }
  return boxes;
}
function cost(tree, width, gap, primary=true) {
  const boxes=place(tree,width,gap);
  if (boxes.some(b=>!Number.isFinite(b.width)||b.width<Math.max(12,Math.min(width,b.minWidth||0))||b.imageHeight<12)) return Infinity;
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
      if(width<500){const readableLead=Math.min(width*.55,180);score+=160*Math.max(0,(readableLead-b.width)/readableLead)**2;}
      // A tall poster can dominate by area without an abrupt 180px cutoff.
      const largestOther=Math.max(0,...boxes.filter(x=>x.index!==b.index).map(x=>x.width*x.imageHeight));
      const goalArea=largestOther*Math.min(1.5,b.visualWeight||1);
      if(goalArea)score+=45*Math.max(0,(goalArea-b.width*b.imageHeight)/goalArea)**2;
    }
  }
  return score;
}
// Do not pair a featured course with an unrelated lunch or individual dish.
const sameGroup=nodes=>new Set(nodes.map(n=>n.group).filter(Boolean)).size<=1;
function rows(nodes,width,gap,primary=true){
  if(!nodes.length)return null;
  const dp=Array(nodes.length+1);dp[nodes.length]={score:0,groups:[]};
  for(let i=nodes.length-1;i>=0;i--){
    let best;
    for(let n=1;n<=Math.min(width<500?2:3,nodes.length-i);n++){
      if(!sameGroup(nodes.slice(i,i+n)))continue;
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
  for(let n=1;n<=Math.min(2,nodes.length);n++)if(sameGroup(nodes.slice(0,n)))for(const tail of partitions(nodes.slice(n),gap))out.push([group('h',nodes.slice(0,n),gap),...tail]);
  return out;
}
export function planGallery(items,width,gap=6){
  width=Math.max(1,finite(width,1));gap=Math.max(0,finite(gap,6));
  if(!items.length)return {height:0,boxes:[],mode:'empty'};
  const nodes=items.map(leaf);
  // Only portrait leads benefit from a side panel. The desired companion count
  // is derived from semantic weights; it is never a fixed four-image template.
  let companions=0;
  if(nodes[0].kind==='campaign'&&nodes[0].a>1.18){
    for(const n of nodes.slice(1)){if(n.kind==='campaign'||n.visualWeight<=1)break;companions++;}
  }
  const semanticCost=count=>60*Math.max(0,companions-count);
  let best=rows(nodes,width,gap), bestCost=cost(best,width,gap)+semanticCost(0), mode='rows';
  if(items.length>=3){
    const counts=new Set(Array.from({length:Math.min(6,nodes.length-1)-1},(_,i)=>i+2));
    // Large groups use polynomial row packing rather than exponential partitions.
    if(companions>6)counts.add(companions);
    for(const n of counts){
      const previous=nodes[n],next=nodes[n+1];
      if(n<companions&&previous.group&&previous.group===next?.group)continue;
      const side=nodes.slice(1,n+1);
      const arrangements=n<=6?partitions(side,gap):[[rows(side,width*.55,gap,false)]];
      for(const parts of arrangements){
        const feature=group('h',[nodes[0],group('v',parts,gap)],gap);
        const rest=rows(nodes.slice(n+1),width,gap,false);
        const candidate=rest?group('v',[feature,rest],gap):feature;
        const score=cost(candidate,width,gap)+semanticCost(n);
        if(score<bestCost){best=candidate;bestCost=score;mode='feature';}
      }
    }
  }
  const boxes=place(best,width,gap).sort((a,b)=>a.index-b.index);
  return {height:best.a*width+best.b,boxes,mode};
}
