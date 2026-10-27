import * as k from './vendor/anatomy/iso-kit.mjs';

// Figure: floor, 2 sills, 2 far walls, 4 posts, 8 corner castings,
// wall ribs, floor crossmembers, upper rails and cartons from the shared model.
export function drawingPlacements(result) {
  // shortcut: large or heuristic loads retain the model's bounded preview; use instancing before expanding these.
  if (result.method !== 'grid' || result.packed > 1800) return result.scene.placements;
  const [nx,ny] = result.cells, [l,w,h] = result.d;
  return Array.from({length:result.packed},(_,i)=>({position:[i%nx*l,Math.floor(i/(nx*ny))*h,Math.floor(i/nx)%ny*w],dimension:[l,h,w]}));
}

export function renderScene(result, layer = Infinity, azimuth = 58, label = '') {
  const [L,H,W] = result.scene.bin.map(n=>n/25), t=1.6;
  const plan={x:-t,y:-t,w:L+2*t,d:W+2*t,r:0};
  const P=k.fitProjection(k.boxCorners(plan,-5,H+3),920,470,{pad:46,azimuth,elevation:28});
  const slab=(x,y,w,d,z,h,tone='mid',inner='')=>k.solidSvg(k.slabOf({x,y,w,d,r:0},z,h,P,1),{tone,inner});
  let back=slab(-t,-t,L+2*t,W+2*t,-3,3,'lo');
  const members=Math.min(60,Math.ceil(L/20)),ribs=Math.min(80,Math.ceil(L/12));
  for(let i=0;i<members;i++) back+=slab(i*L/members,-t,1,W+2*t,-4,1,'lo');
  back+=slab(-t,-t,L+2*t,t,0,H)+slab(-t,0,t,W,0,H);
  for(let i=0;i<ribs;i++) back+=slab((i+.5)*L/ribs,-0.3,1.4,1.6,0,H,'lo');
  const endRibs=Math.min(40,Math.ceil(W/12));
  for(let i=0;i<endRibs;i++) back+=slab(-0.3,(i+.5)*W/endRibs,1.6,1.4,0,H,'lo');
  back+=slab(-t,-t,L+2*t,3,H,2)+slab(-t,-t,3,W+2*t,H,2);
  for(const z of [-3,H]) back+=slab(-t-0.5,-t-0.5,t+1,t+1,z,2,'lo');
  const placements=drawingPlacements(result);
  const levels=[...new Set(placements.map(p=>p.position[1]))].sort((a,b)=>a-b);
  const visible=placements.filter(p=>levels.indexOf(p.position[1])<layer);
  const cargo=visible.map(p=>{
    const [x,z,y]=p.position.map(n=>n/25),[w,h,d]=p.dimension.map(n=>n/25);
    const top=k.lineOnTop([x,y+d/2],[x+w,y+d/2],z+h,P);
    return {depth:k.depthOf([x+w/2,y+d/2,z+h/2],P),svg:slab(x,y,w,d,z,h,'hi',k.lineSvg(top,{tone:'lo'}))};
  }).sort((a,b)=>a.depth-b.depth).map(p=>p.svg).join('');
  let front=slab(-t,W,L+2*t,t,-3,3,'mid')+slab(L,-t,t,W+2*t,-3,3,'mid');
  // Roof and near wall are cut away; the remaining rails preserve the real envelope.
  for(const [x,y] of [[-t,-t],[-t,W],[L,-t],[L,W]]) {
    if(x<0&&y<0) continue;
    front+=slab(x,y,t,t,0,H,'mid');
  }
  for(const [x,y] of [[-t,W],[L,-t],[L,W]]) for(const z of [-3,H])
    front+=slab(x-0.5,y-0.5,t+1,t+1,z,2,'lo');
  const svg=k.figureSvg({width:920,height:470,label,body:back+cargo+front});
  return {svg,levels,visible:visible.length,drawn:placements.length};
}
