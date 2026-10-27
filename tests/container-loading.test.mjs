import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateContainer,newContainerData,containerPresets,validateContainerPlacements} from '../src/container-loading-model.mjs';
import {solveLoose} from '../src/vendor/open-cargo-planner/solver/extreme-point.mjs';
const basis=()=>({...newContainerData(),rotation:'fixed',stacking:'stack',cargo:{length:500,width:400,height:300,gross:20,net:18,units:10},order:1000});
test('three fleet examples, fixed orientation and order round-up',()=>{
 const expected={'20GP':385,'40GP':840,'40HC':1080};
 for(const type of Object.keys(expected)){const r=calculateContainer({...basis(),type,container:{...containerPresets[type]}});assert.deepEqual(r.errors,[]);assert.equal(r.result.packed,expected[type]);assert.equal(r.result.loadGross,expected[type]*20);assert.equal(r.result.loadNet,expected[type]*18);assert.equal(r.result.totalUnits,expected[type]*10);assert.equal(r.result.containers,Math.ceil(1000/expected[type]));}
});
test('payload applies to the whole column, dunnage is counted once',()=>{
 const d=basis();d.container.payload=90;d.dunnage=10;const r=calculateContainer(d).result;assert.equal(r.packed,4);assert.equal(r.loadGross,80);assert.equal(r.containers,250);
});
test('licensed heuristic can improve a uniform grid without losing validation',()=>{
 const d=basis();d.rotation='upright';d.cargo={length:350,width:400,height:500,gross:5};const r=calculateContainer(d).result;assert.equal(r.capacity,336);assert.equal(r.packed,376);assert.equal(r.method,'open-cargo');assert.ok(r.loadGross<=r.payload);
});
test('upstream fork caps vertical columns by remaining payload',()=>{
 const product={id:'a',sku:'a',name:'a',lengthMm:100,widthMm:100,heightMm:100,weightG:20000,quantity:20,allowHorizontalRotation:false,allowSideLoading:false,allowUpsideDown:false,mustStayUpright:true,stackable:true,palletPolicy:'forbidden',priority:0};
 const input={id:'qa',mode:'loose',allocationStrategy:'MAX_PIECES',products:[product],palletTypes:[],minimumSupportRatio:1,containerTypes:[{id:'c',code:'c',name:'c',innerLengthMm:100,innerWidthMm:100,innerHeightMm:1000,doorWidthMm:100,doorHeightMm:100,maxPayloadG:90000,quantity:1}]};
 assert.equal(solveLoose(input).placements.length,4);
 product.stackable=false;assert.equal(solveLoose(input).placements.length,1);
});
test('door exclusion is distinct from fitting inside a container',()=>{
 const d=basis();d.cargo={length:1000,width:1000,height:2350,gross:20};const r=calculateContainer(d).result;assert.equal(r.packed,0);assert.equal(r.doorBlocked,true);assert.equal(r.containers,null);
});
test('floor-only and reserved dimensions reduce capacity',()=>{
 const d=basis();d.stacking='floor';assert.equal(calculateContainer(d).result.packed,55);d.reserveLength=500;assert.equal(calculateContainer(d).result.packed,50);
});
test('required, non-finite, precision, negative and impossible inputs rejected',()=>{
 assert.equal(calculateContainer(newContainerData()).result,null);
 for(const v of ['',0,-1,Infinity,NaN,'NaN',0.000000001]){const d=basis();d.cargo.gross=v;assert.ok(calculateContainer(d).errors.includes('cargo.gross'));}
 const d=basis();d.cargo.net=21;assert.ok(calculateContainer(d).errors.includes('cargo.net'));d.cargo.net='';d.reserveWidth=2352;assert.ok(calculateContainer(d).errors.includes('reserveWidth'));
});
test('blank optional values remain unknown, zero cargo capacity has no order total',()=>{
 const d=basis();d.cargo.net='';d.cargo.units='';d.container.payload=1;const r=calculateContainer(d).result;assert.equal(r.packed,0);assert.equal(r.containers,null);assert.equal(r.loadNet,null);assert.equal(r.totalUnits,null);
});
test('independent validator rejects overlaps, floating boxes, door and payload violations',()=>{
 const p=(x=0,y=0,z=0)=>({x,y,z,orientation:{lengthMm:100,widthMm:100,heightMm:100}}),product={weightG:10000,stackable:true};
 assert.equal(validateContainerPlacements([p(),p(100)], [200,100,100],[100,100],product,2),true);
 for(const ps of [[p(),p()],[p(0,0,1)],[p(101)]])assert.equal(validateContainerPlacements(ps,[200,100,100],[100,100],product,2),false);
 assert.equal(validateContainerPlacements([p()],[200,100,100],[90,100],product,2),false);
 assert.equal(validateContainerPlacements([p(),p(100)],[200,100,100],[100,100],product,1),false);
});
test('small-grid exact boundary and huge plans retain safe arithmetic',()=>{
 const d=basis();d.cargo={length:.001,width:.001,height:.001,gross:1};assert.equal(calculateContainer(d).result,null);
});
