import { solveLoose } from './vendor/open-cargo-planner/solver/extreme-point.mjs';
import { generateOrientations } from './vendor/open-cargo-planner/domain/orientations.mjs';
// Fleet examples, not a specification for every booked container. Verified 2026-10-27.
export const containerPresets = {
  '20GP': {length:5900,width:2352,height:2395,doorWidth:2340,doorHeight:2292,payload:28130,source:'20-standard'},
  '40GP': {length:12032,width:2352,height:2395,doorWidth:2340,doorHeight:2292,payload:28750,source:'40-standard'},
  '40HC': {length:12032,width:2350,height:2700,doorWidth:2340,doorHeight:2597,payload:28600,source:'40-standard-high-cube'},
};
export const containerSource = key => `https://www.hapag-lloyd.com/en/services-information/cargo-fleet/container/${containerPresets[key].source}.html`;
export const newContainerData = () => ({type:'20GP',container:{...containerPresets['20GP']},project:'',cargo:{length:'',width:'',height:'',gross:'',net:'',units:''},rotation:'',stacking:'',maxLayers:'',order:'',dunnage:'0',reserveLength:'0',reserveWidth:'0',reserveHeight:'0'});

export function calculateContainer(data) {
  const errors=[];
  const number=(value,field,{optional=false,zero=false,whole=false}={})=>{
    if(value===''||value===null||value===undefined){if(!optional)errors.push(field);return null;}
    const n=typeof value==='number'||typeof value==='string'?Number(value):NaN;
    if(!Number.isFinite(n)||n<0||(!zero&&Math.round(n*10000)<1)||n>1e9||(whole&&!Number.isSafeInteger(n))||Math.abs(n*10000-Math.round(n*10000))>1e-5){errors.push(field);return null;}return n;
  };
  const c=data.container||{},cargo=data.cargo||{};
  const dimensions=['length','width','height'].map(k=>number(c[k],'container.'+k));
  const door=[number(c.doorWidth,'container.doorWidth'),number(c.doorHeight,'container.doorHeight')];
  const payload=number(c.payload,'container.payload'),dunnage=number(data.dunnage,'dunnage',{zero:true});
  const reserve=['Length','Width','Height'].map(k=>number(data['reserve'+k],'reserve'+k,{zero:true}));
  const box=['length','width','height'].map(k=>number(cargo[k],'cargo.'+k));
  const gross=number(cargo.gross,'cargo.gross'),net=number(cargo.net,'cargo.net',{optional:true}),units=number(cargo.units,'cargo.units',{optional:true,whole:true});
  const order=number(data.order,'order',{optional:true,whole:true}),maxLayers=data.stacking==='floor'?1:null;
  if(!['fixed','upright','any'].includes(data.rotation))errors.push('rotation');
  if(!['floor','stack'].includes(data.stacking))errors.push('stacking');
  dimensions.forEach((n,i)=>{if(n!==null&&reserve[i]!==null&&reserve[i]>=n)errors.push('reserve'+['Length','Width','Height'][i]);});
  if(payload!==null&&dunnage!==null&&dunnage>payload)errors.push('dunnage');
  if(net!==null&&gross!==null&&net>gross)errors.push('cargo.net');
  if(errors.length)return{errors:[...new Set(errors)],result:null};
  const usable=dimensions.map((n,i)=>n-reserve[i]),[l,w,h]=box;
  const orientations=data.rotation==='fixed'?[[l,w,h]]:data.rotation==='upright'?[[l,w,h],[w,l,h]]:[[l,w,h],[w,l,h],[l,h,w],[h,l,w],[w,h,l],[h,w,l]];
  const fits=orientations.filter(d=>d[1]<=door[0]&&d[2]<=door[1]);
  let best={capacity:0,geometry:0,cells:[0,0,0],d:box};
  // Integer dimensions at 0.0001 mm precision avoid floor undercounts at exact boundaries.
  const floorRatio=(a,b)=>Math.floor(Math.round(a*10000)/Math.round(b*10000));
  const weightCapacity=Math.floor((Math.round(payload*10000)-Math.round(dunnage*10000))/Math.round(gross*10000));
  for(const d of fits){
    const cells=usable.map((n,i)=>floorRatio(n,d[i]));if(maxLayers!==null)cells[2]=Math.min(cells[2],maxLayers);
    const geometry=cells.reduce((a,b)=>a*b,1);
    if(!Number.isSafeInteger(geometry))return{errors:['cargo.length','cargo.width','cargo.height'],result:null};
    const capacity=Math.min(geometry,weightCapacity);
    if(capacity>best.capacity||capacity===best.capacity&&geometry>best.geometry)best={capacity,geometry,cells,d};
  }
  let packed=best.capacity,method='grid';
  let placements=Array.from({length:Math.min(packed,240)},(_,i)=>({sku:0,position:[i%best.cells[0]*best.d[0],Math.floor(i/(best.cells[0]*best.cells[1]))*best.d[2],Math.floor(i/best.cells[0])%best.cells[1]*best.d[1]],dimension:[best.d[0],best.d[2],best.d[1]]}));
  const upper=Math.min(weightCapacity,Math.floor(usable.reduce((a,b)=>a*b,1)/box.reduce((a,b)=>a*b,1)));
  // shortcut: large loads use an exact regular-grid count; bounded heuristic search keeps browsers responsive.
  const optimized=upper>0&&upper<=2000&&fits.length>0;
  if(optimized){
    const product={id:'cargo',sku:'cargo',name:'cargo',lengthMm:l,widthMm:w,heightMm:h,weightG:Math.round(gross*10000),quantity:upper,allowHorizontalRotation:data.rotation!=='fixed',allowSideLoading:data.rotation==='any',allowUpsideDown:false,mustStayUpright:data.rotation!=='any',stackable:maxLayers!==1,maxStackLayers:maxLayers??undefined,palletPolicy:'forbidden',priority:0};
    product.allowedOrientations=generateOrientations(product).filter(d=>d.widthMm<=door[0]&&d.heightMm<=door[1]).map(d=>d.code);
    const candidate=solveLoose({id:'container',mode:'loose',allocationStrategy:'MAX_PIECES',products:[product],palletTypes:[],containerTypes:[{id:'container',code:data.type,name:data.type,innerLengthMm:usable[0],innerWidthMm:usable[1],innerHeightMm:usable[2],doorWidthMm:door[0],doorHeightMm:door[1],maxPayloadG:Math.round(payload*10000)-Math.round(dunnage*10000),quantity:1}],minimumSupportRatio:1});
    if(candidate.placements.length>packed&&validateContainerPlacements(candidate.placements,usable,door,product,payload-dunnage)){
      packed=candidate.placements.length;method='open-cargo';placements=candidate.placements.slice(0,240).map(p=>({sku:0,position:[p.x,p.z,p.y],dimension:[p.orientation.lengthMm,p.orientation.heightMm,p.orientation.widthMm]}));
    }
  }
  const containers=order!==null&&packed>0?Math.ceil(order/packed):null,last=containers===null?null:(order%packed||packed);
  if(units!==null&&!Number.isSafeInteger(units*packed))return{errors:['cargo.units'],result:null};
  return{errors:[],result:{...best,packed,method,optimized,weightCapacity,doorBlocked:!fits.length,containers,last,order,dimensions,usable,door,payload,dunnage,gross,net,units,cargoVolume:box.reduce((a,b)=>a*b,1)/1e9,loadGross:packed*gross,loadNet:net===null?null:packed*net,totalUnits:units===null?null:packed*units,utilization:packed*box.reduce((a,b)=>a*b,1)/usable.reduce((a,b)=>a*b,1)*100,
    scene:{bin:[usable[0],usable[2],usable[1]],items:[{name:'Cargo',packed}],packed,placements,visualTruncated:packed>240}}};
}

export function validateContainerPlacements(placements,bin,door,product,payload){
  if(placements.length*product.weightG>Math.round(payload*10000))return false;
  const boxes=[];
  for(const p of placements){
    const d=[p.orientation.lengthMm,p.orientation.widthMm,p.orientation.heightMm],pos=[p.x,p.y,p.z];
    if(d[1]>door[0]||d[2]>door[1]||pos.some((n,i)=>!Number.isFinite(n)||n<0||n+d[i]>bin[i]+1e-6))return false;
    if(!product.stackable&&p.z>0)return false;
    let support=0;
    for(const b of boxes){
      if(pos.every((n,i)=>n<b.pos[i]+b.d[i]-1e-6&&b.pos[i]<n+d[i]-1e-6))return false;
      if(Math.abs(b.pos[2]+b.d[2]-p.z)<1e-6)support+=Math.max(0,Math.min(p.x+d[0],b.pos[0]+b.d[0])-Math.max(p.x,b.pos[0]))*Math.max(0,Math.min(p.y+d[1],b.pos[1]+b.d[1])-Math.max(p.y,b.pos[1]));
    }
    if(p.z>0&&support+1e-6<d[0]*d[1])return false;
    boxes.push({pos,d});
  }
  return true;
}
