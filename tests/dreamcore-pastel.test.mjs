import test from 'node:test';
import assert from 'node:assert/strict';
import {createDreamGrainData,drawWorld,drawForeground} from '../js/worlds.js';
import {createDreamPointer,updateDreamPointer} from '../js/pointer.js';
import {environments} from '../js/environments.js';

function record(t=2,reduced=false){
 const commands=[];
 const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{commands.push([key,...args]);if(key.startsWith('create'))return {addColorStop:(...v)=>commands.push(['stop',...v])};},set:(_,key,value)=>{commands.push([key,value]);return true;}});
 const f={ctx,w:900,h:500,t,dt:1/60,signal:{bass:.4,mid:.3,high:.02,level:.1},preset:environments.dreamcore,reduced,point:(x,y)=>({x,y}),ink:(...v)=>JSON.stringify(v)};
 drawWorld(f);drawForeground(f);return {commands,ctx,f};
}
test('pastel fields use the supplied swatches, move gradually and freeze their motion when reduced',()=>{
 const a=record(2),b=record(2.02),later=record(10);
 assert.ok(!JSON.stringify(a.commands).includes('#21152F'));
 const colours=a.commands.filter(c=>c[0]==='stop').map(c=>c[2]);
 for(const swatch of ['168,233,236','145,207,232','200,181,234','233,184,220','245,197,173','244,241,237'])assert.ok(colours.some(c=>c.includes(swatch)),swatch);
 const centers=record=>record.commands.filter(c=>c[0]==='translate').slice(0,18);
 assert.notDeepEqual(centers(a),centers(later));
 assert.ok(Math.abs(centers(a)[0][1]-centers(b)[0][1])<1,'no abrupt gradient position jump');
 assert.deepEqual(centers(record(0,true)),centers(record(100,true)));
 const scales=a.commands.filter(c=>c[0]==='scale');
 assert.ok(new Set(scales.map(c=>Math.round(c[1]))).size>6,'varied fields and cloud sizes');
});
test('noise tile has deterministic fine grain and balanced coverage without frame-time generation',()=>{
 const a=createDreamGrainData();assert.equal(a.length,128*128*4);assert.deepEqual(a,createDreamGrainData());
 for(let row=0;row<128;row++){
  let white=0;for(let x=0;x<128;x++){const i=(row*128+x)*4;assert.ok(a[i+3]>=16&&a[i+3]<=40);if(a[i]===255)white++;}
  assert.ok(white>35&&white<95,'grain is spread through each row');
 }
 let allocated=0,uploads=0;
 globalThis.OffscreenCanvas=class{constructor(){allocated++;}getContext(){return {createImageData:()=>({data:new Uint8ClampedArray(128*128*4)}),putImageData(){uploads++;}};}};
 const {ctx,f,commands}=record();
 for(let i=0;i<20;i++){drawWorld(f);drawForeground(f);}
 assert.equal(allocated,1);assert.equal(uploads,1);assert.equal(commands.filter(c=>c[0]==='createPattern').length,1);
 assert.ok(commands.some(c=>c[0]==='globalAlpha'&&c[1]===.32));
 delete globalThis.OffscreenCanvas;
});
test('Dreamcore filter damps sudden strength/position changes without changing input or click coordinates',()=>{
 const state=createDreamPointer(),pulse={x:.1,y:.8,time:0},input={x:.2,y:.3,targetX:.2,targetY:.3,vx:0,vy:0,strength:0,inside:true,pulses:[pulse]};
 updateDreamPointer(state,input,1/60);input.targetX=.9;input.targetY=.7;input.strength=1;input.vx=4;
 const snapshot=JSON.stringify(input);updateDreamPointer(state,input,1/60);
 assert.ok(state.x>.2&&state.x<.9);assert.ok(state.strength>0&&state.strength<.2);assert.ok(state.vx>0&&state.vx<4);
 assert.ok(state.x>.35,'fast movement catches up promptly');
 for(let i=0;i<120;i++){const before=state.x;updateDreamPointer(state,input,1/60);assert.ok(state.x>=before&&state.x<=.9);}
 assert.ok(Math.abs(state.x-.9)<1e-6);assert.equal(JSON.stringify(input),snapshot);assert.equal(state.pulses,input.pulses);assert.equal(state.pulses[0],pulse);
 input.strength=0;updateDreamPointer(state,input,1/60);assert.ok(state.strength>0&&state.strength<1);
 assert.equal(updateDreamPointer(state,null,1/60),null);assert.equal(state.initialized,false);
});
