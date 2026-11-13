import test from 'node:test';
import assert from 'node:assert/strict';
import {drawPointer} from '../js/pointer.js';
import {attachPointer} from '../js/pointer.js';

function render(environment,time=500,reduced=false,width=900,height=500,count=1){
 const commands=[];
 const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{
  commands.push([key,...args]);
  if(key.startsWith('create'))return {addColorStop(...v){commands.push(['stop',...v]);}};
 },set:(_,key,value)=>{commands.push([key,value]);return true;}});
 drawPointer(ctx,{strength:0,pulses:Array.from({length:count},()=>({x:.5,y:.5,time:0}))},environment,width,height,time,(...v)=>JSON.stringify(v),reduced);
 return commands;
}
test('five click identities use water rings, bloom, stellar rays, analog lines and targeting square',()=>{
 const commands=Object.fromEntries(['underwater','dreamcore','space','retro','cyberpunk'].map(e=>[e,render(e)]));
 const count=(e,op)=>commands[e].filter(c=>c[0]===op).length;
 assert.equal(count('underwater','ellipse'),3);assert.equal(count('underwater','arc'),0);
 assert.equal(count('dreamcore','createRadialGradient'),7);
 assert.equal(count('space','lineTo'),12);assert.equal(count('space','arc'),12);
 assert.equal(count('retro','lineTo'),5);assert.equal(count('retro','fillRect'),0);
 assert.equal(count('cyberpunk','fillRect'),0);assert.equal(count('cyberpunk','strokeRect'),1);
 for(const e of ['dreamcore','space','retro','cyberpunk'])assert.equal(count(e,'ellipse'),0);
});
test('Cyberpunk reticle has exactly two visible windows, stays centred and expires from input state',()=>{
 let previous=false,appearances=0;
 for(let t=0;t<1700;t+=10){
  const rects=render('cyberpunk',t).filter(c=>c[0]==='strokeRect');const visible=rects.length>0;
  if(visible&&!previous)appearances++;previous=visible;
  for(const [,x,y,w,h] of rects){assert.equal(w,h);assert.equal(x+w/2,450);assert.equal(y+h/2,250);}
 }
 assert.equal(appearances,2);
 const listeners={};globalThis.window={addEventListener(){}};
 const input=attachPointer({getBoundingClientRect:()=>({left:20,top:30,width:600,height:400}),addEventListener:(k,fn)=>listeners[k]=fn},()=> 'cyberpunk');
 const e={isPrimary:true,pointerId:1,pointerType:'mouse',button:0,clientX:320,clientY:230};
 listeners.pointerdown(e);listeners.pointerup(e);const now=performance.now(),p=input.sample(now).pulses[0];
 assert.equal(p.x,.5);assert.equal(p.y,.5);assert.equal(p.lifetime,520);
 assert.equal(input.sample(now+521).pulses.length,0);
});
test('click effects fade, stay finite and bounded at different sizes and reduced motion',()=>{
 for(const env of ['underwater','dreamcore','space','retro','cyberpunk']){
  const early=render(env,env==='cyberpunk'?40:200),late=render(env,1400);
  const alphas=cs=>cs.flatMap(c=>c[0]==='stop'?[JSON.parse(c[2])[1]]:['strokeStyle','fillStyle'].includes(c[0])&&typeof c[1]==='string'?[JSON.parse(c[1])[1]]:[]);
  assert.ok(Math.max(...alphas(late))<Math.max(...alphas(early)),env);
  // The input layer discards pulses at 1.6 seconds, including Retro's legacy effect.
  if(env!=='retro')assert.equal(render(env,1600).length,0);
  for(const reduced of [false,true])for(const [w,h] of [[280,330],[390,570],[1280,570]])for(const time of [0,800,1599]){
   const commands=render(env,time,reduced,w,h,12);assert.ok(commands.length<2400);
   for(const command of commands)for(const n of command)if(typeof n==='number')assert.ok(Number.isFinite(n));
  }
 }
});
