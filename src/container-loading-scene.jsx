import React,{useId,useMemo,useState} from 'react';
import {renderScene} from './container-loading-scene-model.mjs';
import {containerCopy} from './container-loading-content.mjs';
import './vendor/anatomy/iso.css';

export default function ContainerScene({plan,languageCode='EN',interactive=true}){
 const c=containerCopy(languageCode),id=useId(),[layer,setLayer]=useState(Infinity),[angle,setAngle]=useState(58);
 const view=useMemo(()=>renderScene(plan,interactive?layer:Infinity,interactive?angle:58,c.scene),[plan,layer,angle,interactive,c.scene]);
 const shown=Math.min(layer,view.levels.length),n=value=>new Intl.NumberFormat('en').format(value);
 return <figure className="container-scene iso" data-theme="light">
  <div className="iso-plate"><div className="container-scene-heading"><span>FIG 01</span><span>{c.cutaway}</span></div><div className="container-scene-art" dangerouslySetInnerHTML={{__html:view.svg}}/><p className="container-scene-readout" data-testid="container-scene-readout">{c.layers}: {shown} / {view.levels.length} · {c.visibleCartons}: {n(view.visible)}</p></div>
  {interactive&&<div className="container-scene-controls"><label htmlFor={id+'-layers'}>{c.layerControl}<input id={id+'-layers'} type="range" min="1" max={Math.max(1,view.levels.length)} value={shown||1} disabled={!view.levels.length} onChange={e=>setLayer(Number(e.target.value))}/></label><label htmlFor={id+'-angle'}>{c.angleControl}<input id={id+'-angle'} type="range" min="35" max="75" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label></div>}
  <figcaption>{c.cutawayHelp} {view.drawn<plan.packed?`${c.previewLimit} ${n(view.drawn)} / ${n(plan.packed)}.`:c.fullPreview}{interactive&&' '+c.printView}</figcaption>
 </figure>;
}
