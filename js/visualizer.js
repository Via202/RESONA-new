import {influence,drawPointer,createDreamPointer,updateDreamPointer} from './pointer.js';
import {parameters as defaultParameters,visualParameters} from './parameters.js';
import {environments} from './environments.js';
import {drawWorld,drawForeground} from './worlds.js';
import {languages} from './languages.js';
export function createVisualizer(canvas){
 const ctx=canvas.getContext('2d');let w=0,h=0,t=0,last=0,tapePhase=0;
 const dreamPointer=createDreamPointer();
 const resize=()=>{const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);w=box.width;h=box.height;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
 new ResizeObserver(resize).observe(canvas);resize();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const palette={background:[...environments.underwater.background],edge:[...environments.underwater.edge],hue:environments.underwater.hue};
 return (time,signal,preset=environments.underwater,style='liquid',parameters=defaultParameters,pointer=null,renderField,playing=false)=>{
 const dt=Math.min(Math.max(0,(time-last)/1000),.05);last=time;const controls=visualParameters(parameters);
 if(preset.id==='dreamcore')pointer=updateDreamPointer(dreamPointer,pointer,dt);else dreamPointer.initialized=false;
 t+=dt*controls.speed*preset.speed*(reduced?.08:1)*(1+signal.mid*.5);
 const blend=1-Math.exp(-dt*5);for(const key of ['background','edge'])for(let i=0;i<3;i++)palette[key][i]+=(preset[key][i]-palette[key][i])*blend;palette.hue+=(preset.hue-palette.hue)*blend;
 const cyberpunk=preset.id==='cyberpunk';
 const baseHue=(cyberpunk?138:palette.hue)+controls.hueShift;
 const ink=(offset=0,alpha=1,light=65)=>{
   const opacity=Math.max(0,Math.min(1,alpha));
   if(cyberpunk){
     const phosphorLight=Math.max(12,Math.min(94,light+Math.sin(offset*.04)*8));
     return `hsla(${baseHue},61%,${phosphorLight}%,${opacity})`;
   }
   return `hsla(${baseHue+offset},78%,${light}%,${opacity})`;
 };
 if(cyberpunk&&renderField){
   renderField({w,h,pointer},time);
   return;
 }
 if(cyberpunk)ctx.fillStyle='#050706';
 else{
   const bg=ctx.createRadialGradient(w*.5,h*.4,0,w*.5,h*.5,Math.max(w,h)*.7);bg.addColorStop(0,`rgb(${palette.background.join(',')})`);bg.addColorStop(1,`rgb(${palette.edge.join(',')})`);ctx.fillStyle=bg;
 }
 ctx.fillRect(0,0,w,h);
 const point=(x,y,index=0)=>influence(x,y,w,h,pointer,preset.id,time,index,reduced);
 if(preset.id==="retro"&&style==="glitch"&&playing&&!reduced)tapePhase=(tapePhase+dt*1.8)%3;
 const frame={ctx,w,h,t,dt,signal,preset,controls,pointer,reduced,point,ink,baseHue,tapePhase};
 ctx.save();drawWorld(frame);(languages[style]||languages.liquid)(frame);drawForeground(frame);drawPointer(ctx,pointer,preset.id,w,h,time,ink,reduced);ctx.restore();
 };
}
export const createLiquid=createVisualizer;
