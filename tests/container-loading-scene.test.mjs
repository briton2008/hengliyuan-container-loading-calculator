import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateContainer,newContainerData,containerPresets} from '../src/container-loading-model.mjs';
import {drawingPlacements,renderScene} from '../src/container-loading-scene-model.mjs';
function estimate(type='20GP'){
 const data={...newContainerData(),type,container:containerPresets[type],rotation:'fixed',stacking:'stack',cargo:{length:'500',width:'400',height:'300',gross:'20',net:'',units:''}};
 return calculateContainer(data).result;
}
test('full grid and cumulative layers preserve all real coordinates',()=>{
 for(const [type,count,bottom] of [['20GP',385,55],['40GP',840,120],['40HC',1080,120]]){
  const result=estimate(type),positions=drawingPlacements(result);
  assert.equal(positions.length,count);assert.equal(renderScene(result,1).visible,bottom);
  for(const p of positions)p.position.forEach((v,i)=>assert.ok(v>=0&&v+p.dimension[i]<=result.scene.bin[i]));
  assert.equal(renderScene(result).visible,count);
 }
});
test('heuristic and huge loads retain bounded previews without fabricated positions',()=>{
 const result=estimate();for(const changes of [{method:'open-cargo'},{packed:1000000000}]){
  const p={...result,...changes};assert.equal(drawingPlacements(p),p.scene.placements);assert.equal(renderScene(p).drawn,240);
 }
});
test('empty, huge custom container and view controls render finite bounded geometry',()=>{
 const result={...estimate(),packed:0,scene:{bin:[1e9,1e9,1e9],placements:[]}};
 const view=renderScene(result,Infinity,75,'Container loading arrangement');
 assert.equal(view.visible,0);assert.ok(view.svg.length<200000);assert.ok(!/NaN|Infinity/.test(view.svg));
 const full=estimate();assert.equal(renderScene(full,1,35).visible,renderScene(full,1,75).visible);
});
