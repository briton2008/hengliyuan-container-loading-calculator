import {calculateContainer,containerPresets} from './container-loading-model.mjs';
self.onmessage=({data})=>{
  try{
    const checked=calculateContainer(data);
    const comparison=checked.result?Object.keys(containerPresets).map(type=>({type,...(type===data.type?checked:calculateContainer({...data,type,container:{...containerPresets[type]}}))})):[];
    self.postMessage({...checked,comparison});
  }catch{self.postMessage({failed:true});}
};
