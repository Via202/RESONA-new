import test from 'node:test';
import assert from 'node:assert/strict';
import {createDreamField,updateDreamField,createDreamResponse,updateDreamResponse,drawWorld,drawForeground,drawDreamStar} from '../js/worlds.js';
import {environments} from '../js/environments.js';
import {drawPointer} from '../js/pointer.js';
const quiet={bass:0,mid:0,high:0,level:0};
test('Dreamcore decorative star has exactly five outer tips and no four-cornered path',()=>{
 const vertices=[];drawDreamStar({beginPath(){},moveTo:(...p)=>vertices.push(p),lineTo:(...p)=>vertices.push(p),closePath(){}},20);
 assert.equal(vertices.length,10);
 vertices.forEach(([x,y],i)=>assert.ok(Math.abs(Math.hypot(x,y)-(i%2?8.6:20))<1e-10));
 assert.ok(vertices[0][1]<0);
});
test('Dreamcore poses reuse fixed storage with varied depth, motion and gradual visibility',()=>{
 const field=createDreamField();assert.equal(field.length,48);
 updateDreamField(field,900,500,0,quiet);const initial=Array.from(field);
 assert.equal(updateDreamField(field,900,500,0,quiet),field);assert.deepEqual(Array.from(field),initial);
 assert.ok(new Set(initial.filter((_,i)=>i%6===2)).size>3);
 updateDreamField(field,900,500,4,quiet);assert.notDeepEqual(Array.from(field),initial);
 for(let i=0;i<8;i++){assert.ok(Math.abs(field[i*6]-initial[i*6])<30);assert.ok(field[i*6+4]>=0&&field[i*6+4]<=1);}
 for(const [w,h] of [[280,330],[390,570],[1280,570]])for(const reduced of [false,true])for(const t of [0,23,10000]){
  updateDreamField(field,w,h,t,{bass:1,mid:1,high:1,level:1},reduced);
  for(const n of field)assert.ok(Number.isFinite(n));for(let i=0;i<8;i++)assert.ok(field[i*6+2]>0);
 }
});
test('Dreamcore envelopes and object motion react smoothly without pointer input',()=>{
 const state=createDreamResponse();updateDreamResponse(state,{bass:1,mid:1,high:1,level:1},1/60);
 for(const n of Object.values(state))assert.ok(n>0&&n<.2);
 const base=updateDreamField(createDreamField(),900,500,2,quiet),active=updateDreamField(createDreamField(),900,500,2,{bass:.6,mid:.5,high:.4,level:.5});
 assert.ok(active[6*6+2]-base[6*6+2]>2,'near star breathes with bass');assert.notEqual(active[6*6],base[6*6]);
 for(let i=0;i<300;i++)updateDreamResponse(state,quiet,1/60);assert.ok(state.bass<1e-6);
});
function render(signal,t=2,reduced=false){
 const commands=[];
 const ctx=new Proxy({}, {get:(_,key)=>key.startsWith('create')?(...a)=>{commands.push([key,...a]);return {addColorStop(...v){commands.push(['stop',...v]);}};}:(...a)=>commands.push([key,...a]),set:(_,key,value)=>{commands.push([key,value]);return true;}});
 const f={ctx,w:900,h:500,t,dt:1/60,signal,preset:environments.dreamcore,point:(x,y)=>({x,y,force:0}),ink:(...a)=>JSON.stringify(a),reduced};
 for(let i=0;i<120;i++){commands.length=0;drawWorld(f);}drawForeground(f);
 for(const command of commands)for(const value of command)if(typeof value==='number')assert.ok(Number.isFinite(value));
 assert.ok(commands.length<1800);return JSON.stringify(commands);
}
test('stationary-pointer scenery visibly consumes every audio band and remains deterministic',()=>{
 const base=render(quiet);assert.equal(base,render(quiet));
 for(const band of Object.keys(quiet))assert.notEqual(render({...quiet,[band]:band==='high'?.03:.4}),base,band);
 render({bass:1,mid:1,high:1,level:1},23,true);
});
test('Dreamcore click blooms through soft lobes instead of concentric rings',()=>{
 const draw=reduced=>{
  const commands=[];const ctx=new Proxy({}, {get:(_,key)=>key.startsWith('create')?(...a)=>{commands.push([key,...a]);return {addColorStop(){}};}:(...a)=>commands.push([key,...a]),set:()=>true});
  drawPointer(ctx,{x:.5,y:.5,strength:0,vx:0,vy:0,pulses:[{x:.5,y:.5,time:0}]},'dreamcore',900,500,800,()=>'',reduced);
  assert.equal(commands.filter(c=>c[0]==='ellipse').length,0);
  return commands.filter(c=>c[0]==='createRadialGradient');
 };
 const normal=draw(false),reduced=draw(true);assert.equal(normal.length,7);assert.ok(reduced[0][6]<normal[0][6]);
});
