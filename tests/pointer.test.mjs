import test from 'node:test';
import assert from 'node:assert/strict';
import {createPointerState,influence,attachPointer} from '../js/pointer.js';
test('movement interpolates, faster movement is stronger, leaving decays to rest',()=>{
  const slow=createPointerState(),fast=createPointerState();
  for(const p of [slow,fast]){p.move(.3,.5,0);p.sample(0);}
  slow.move(.4,.5,1000);fast.move(.4,.5,20);
  assert.ok(fast.sample(20).strength>slow.sample(1000).strength);
  assert.ok(fast.sample(30).x>.3&&fast.sample(30).x<.4);
  assert.ok(fast.sample(30).vx>0);
  fast.leave();for(let t=100;t<=5000;t+=50)fast.sample(t);
  const state=fast.sample(5000);assert.ok(state.strength<.00001);
  for(const env of ['underwater','dreamcore','space','retro','cyberpunk']){const p=influence(420,250,900,500,state,env,5000);assert.ok(Math.abs(p.x-420)<.01);}
});
test('inactivity decays, click effects expire and rapid clicks are bounded',()=>{
  const p=createPointerState();p.move(.3,.3,0);p.sample(0);p.move(.6,.6,20);
  const initial=p.sample(20).strength;
  for(let i=0;i<100;i++)p.click(.5,.5,20);
  assert.equal(p.sample(20).pulses.length,12);
  for(let t=40;t<4000;t+=20)p.sample(t);
  assert.ok(p.sample(4000).strength<initial*.001);assert.equal(p.sample(4000).pulses.length,0);
});
test('environment fields are local and reduced motion weakens displacement',()=>{
  const pointer={x:.5,y:.5,strength:1};
  assert.ok(influence(480,250,900,500,pointer,'underwater',0).x>480);
  assert.ok(influence(480,250,900,500,pointer,'dreamcore',0).x<480);
  for(const env of ['underwater','dreamcore','space','retro','cyberpunk']){
    const far=influence(0,0,900,500,pointer,env,0);assert.equal(far.force,0);
    const near=influence(480,250,900,500,pointer,env,0),reduced=influence(480,250,900,500,pointer,env,0,0,true);assert.ok(reduced.force<near.force);
  }
});
test('touch tap, drag cancellation and mouse leave use pointer events without blocking scroll',()=>{
  const listeners={};globalThis.window={addEventListener(){}};
  const input=attachPointer({getBoundingClientRect:()=>({left:0,top:0,width:500,height:300}),addEventListener:(name,fn)=>listeners[name]=fn});
  const event={pointerId:1,isPrimary:true,pointerType:'touch',button:0,clientX:100,clientY:100};
  listeners.pointerdown(event);listeners.pointerup(event);assert.equal(input.sample(performance.now()).pulses.length,1);
  listeners.pointerdown(event);listeners.pointermove({...event,clientX:300});listeners.pointercancel();assert.equal(input.sample(performance.now()).inside,false);
  listeners.pointerup({...event,clientX:300});assert.equal(input.sample(performance.now()).pulses.length,1);
});
