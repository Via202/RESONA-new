import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisualizer} from '../js/visualizer.js';
import {environments,styles} from '../js/environments.js';
import {parameters,randomizeVisuals} from '../js/parameters.js';
import {languages} from '../js/languages.js';

// A recording Canvas stub checks every renderer's response to each analyser band.
function render(preset,style,signal,settings=parameters,pointer=null,size={width:900,height:500},reduced=false){
  const commands=[];
  const context=new Proxy({}, {
    get(_target,key){
      if((key==='createRadialGradient'||key==='createLinearGradient'))return (...args)=>{commands.push([key,...args]);return {addColorStop(...values){commands.push(['stop',...values]);}};};
      return (...args)=>commands.push([key,...args]);
    },
    set(_target,key,value){commands.push([key,value]);return true;}
  });
  globalThis.devicePixelRatio=1;
  globalThis.ResizeObserver=class{observe(){}};
  globalThis.matchMedia=()=>({matches:reduced});
  const draw=createVisualizer({getContext:()=>context,getBoundingClientRect:()=>size});
  draw(1000,signal,preset,style,settings,pointer);
  for(const command of commands)for(const value of command)if(typeof value==='number')assert.ok(Number.isFinite(value));
  return JSON.stringify(commands);
}
test('all twenty combinations render and react independently to each audio band',()=>{
  const quiet={bass:0,mid:0,high:0,level:0};
  for(const preset of Object.values(environments))for(const style of Object.keys(styles)){
    const baseline=render(preset,style,quiet);
    for(const band of Object.keys(quiet))assert.notEqual(render(preset,style,{...quiet,[band]:.8}),baseline,`${preset.name}/${style}/${band}`);
  }
});
test('all twenty combinations retain audio rendering with pointer movement and click overlays',()=>{
  const signal={bass:.5,mid:.4,high:.3,level:.2};
  const pointer={x:.5,y:.5,vx:1,vy:-.5,strength:.8,pulses:[{x:.5,y:.5,time:500}]};
  for(const preset of Object.values(environments))for(const style of Object.keys(styles))assert.ok(render(preset,style,signal)!==render(preset,style,signal,parameters,pointer));
});
test('every parameter changes every style in every environment, including extremes',()=>{
  const signal={bass:.5,mid:.4,high:.3,level:.2};
  for(const preset of Object.values(environments))for(const style of Object.keys(styles)){
    for(const name of Object.keys(parameters)){
      const low=render(preset,style,signal,{...parameters,[name]:0});
      const high=render(preset,style,signal,{...parameters,[name]:100});
      assert.ok(low!==high,`${preset.name}/${style}/${name}`);
    }
    render(preset,style,signal,{chaos:100,speed:100,distortion:100,color:100});
    render(preset,style,signal,{chaos:0,speed:0,distortion:0,color:0});
  }
});
test('randomization updates only four parameters, spans all styles and keeps bounds',()=>{
  for(const value of [0,.25,.5,.75,.999999]){
    const state={...parameters,environment:'underwater',currentTime:12};
    const style=randomizeVisuals(state,Object.keys(styles),()=>value);
    assert.equal(style,Object.keys(styles)[Math.floor(value*4)]);
    assert.equal(state.environment,'underwater');assert.equal(state.currentTime,12);
    for(const name of Object.keys(parameters))assert.equal(state[name],Math.floor(value*101));
  }
});

test('all regular visualizers share the full Color shift during environment changes',()=>{
  const signal={bass:.5,mid:.4,high:.3,level:.2};
  const original={...languages};
  const received={};
  try {
    for(const style of Object.keys(original))languages[style]=frame=>{
      received[style]=frame.baseHue;
      assert.equal(Number(/^hsla\(([^,]+)/.exec(frame.ink())[1]),frame.baseHue);
      original[style](frame);
    };
    for(const preset of Object.values(environments)){
      for(const color of [0,17,33,50,61,84,100]){
        for(const style of Object.keys(original))render(preset,style,signal,{...parameters,color});
        const environmentHue=preset.id==='cyberpunk'?138:
          environments.underwater.hue+(preset.hue-environments.underwater.hue)*(1-Math.exp(-.05*5));
        for(const hue of Object.values(received))assert.equal(hue,environmentHue+(color-50)*3.6);
      }
    }
  } finally {
    Object.assign(languages,original);
  }
});

test('all twenty combinations support portrait, mobile and desktop sizes with reduced motion',()=>{
 for(const size of [{width:280,height:330},{width:390,height:570},{width:1280,height:570}])for(const preset of Object.values(environments))for(const style of Object.keys(styles))render(preset,style,{bass:1,mid:1,high:1,level:1},{chaos:100,speed:100,distortion:100,color:100},null,size,true);
});

test('Space uses CSS coordinates across resizing and DPR while capping backing resolution',()=>{
 for(const dpr of [1,2,3]){
  let size={width:390,height:330},resize;const transforms=[];
  const ctx=new Proxy({}, {get:(_,key)=>key==='setTransform'?(...a)=>transforms.push(a):key.startsWith('create')?()=>({addColorStop(){}}):(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));},set:()=>true});
  globalThis.devicePixelRatio=dpr;globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}};globalThis.matchMedia=()=>({matches:false});
  const canvas={getContext:()=>ctx,getBoundingClientRect:()=>size},draw=createVisualizer(canvas),pointer={x:.4,y:.6,inside:true,strength:0,pulses:[]};
  for(const dimensions of [{width:390,height:330},{width:1280,height:570}]){
   size=dimensions;resize();draw(1000,{bass:.4,mid:.3,high:.02,level:.1},environments.space,'liquid',parameters,pointer);
   assert.equal(canvas.width,Math.round(size.width*Math.min(2,dpr)));assert.equal(canvas.height,Math.round(size.height*Math.min(2,dpr)));
   assert.deepEqual(transforms.at(-1),[Math.min(2,dpr),0,0,Math.min(2,dpr),0,0]);
  }
 }
});
