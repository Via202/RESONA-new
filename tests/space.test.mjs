import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpaceField,updateSpaceField} from '../js/worlds.js';
const signal={bass:.5,mid:.4,high:.3,level:.2};
const identity=(x,y)=>({x,y});
test('star links obey distance, degree, uniqueness and global work limits',()=>{
 for(const [w,h] of [[280,330],[390,570],[1280,570]])for(const t of [0,10,10000]){
  const f=updateSpaceField(createSpaceField(),w,h,t,signal,identity);
  assert.equal(f.x.length,72);assert.ok(f.count>0&&f.count<=90);assert.ok(f.checks<=5112);
  assert.ok(f.degree.every(n=>n<=3));const seen=new Set(),links=[];
  for(let i=0;i<f.count;i++){
   const a=f.from[i],b=f.to[i],key=a+':'+b;assert.ok(a<b);assert.ok(!seen.has(key));seen.add(key);
   const distance=Math.hypot(f.x[a]-f.x[b],f.y[a]-f.y[b]);assert.ok(distance<f.range);
   assert.ok(f.opacity[i]>0&&f.opacity[i]<=1);links.push({distance,alpha:f.opacity[i]});
  }
  links.sort((a,b)=>a.distance-b.distance);for(let i=1;i<links.length;i++)assert.ok(links[i].alpha<=links[i-1].alpha+1e-12);
 }
});
test('field updates reuse buffers, remain deterministic and change connections over time',()=>{
 const f=createSpaceField(),x=f.x,to=f.to;
 updateSpaceField(f,900,500,0,signal,identity);
 const initial=Array.from(f.from.slice(0,f.count)).map((a,i)=>a+':'+f.to[i]).join(',');
 const reference=updateSpaceField(createSpaceField(),900,500,0,signal,identity);
 assert.deepEqual(f,reference);
 updateSpaceField(f,900,500,100,signal,identity);assert.equal(f.x,x);assert.equal(f.to,to);
 const later=Array.from(f.from.slice(0,f.count)).map((a,i)=>a+':'+f.to[i]).join(',');assert.notEqual(initial,later);
 for(const value of [...f.x,...f.y])assert.ok(Number.isFinite(value));
});
test('bass, mids and pointer influence change star positions without changing particle count',()=>{
 const quiet={bass:0,mid:0,high:0,level:0};
 const baseline=updateSpaceField(createSpaceField(),900,500,2,quiet,identity);
 for(const band of ['bass','mid']){
  const active=updateSpaceField(createSpaceField(),900,500,2,{...quiet,[band]:1},identity);
  assert.notDeepEqual(active.x,baseline.x);assert.equal(active.x.length,72);
 }
 const disturbed=updateSpaceField(createSpaceField(),900,500,2,quiet,(x,y)=>({x:x+10,y:y-5}));assert.notDeepEqual(disturbed.x,baseline.x);
});

test('stationary cursor attracts nearby stars, distant stars stay on course and release returns them',()=>{
 for(const [w,h] of [[280,330],[390,570],[1280,570]]){
  const base=updateSpaceField(createSpaceField(),w,h,2,signal,identity),f=createSpaceField();
  const pointer={x:base.x[0]/w+.08,y:base.y[0]/h,strength:0,inside:true};
  for(let i=0;i<120;i++)updateSpaceField(f,w,h,2,signal,identity,pointer);
  const px=pointer.x*w,py=pointer.y*h,distance=(field,i)=>Math.hypot(field.x[i]-px,field.y[i]-py);
  assert.ok(distance(f,0)<distance(base,0)*.75,'visible pull survives zero movement velocity');
  for(let i=0;i<72;i++)if(distance(base,i)>Math.min(w,h)*.38){assert.equal(f.x[i],base.x[i]);assert.equal(f.y[i],base.y[i]);}
  const offset=Math.hypot(f.offsetX[0],f.offsetY[0]);pointer.inside=false;
  updateSpaceField(f,w,h,2,signal,identity,pointer);assert.ok(Math.hypot(f.offsetX[0],f.offsetY[0])<offset);assert.ok(Math.abs(f.offsetX[0])>0);
  for(let i=0;i<600;i++)updateSpaceField(f,w,h,2,signal,identity,pointer);
  assert.ok(Math.hypot(f.x[0]-base.x[0],f.y[0]-base.y[0])<1e-6);
  pointer.inside=true;updateSpaceField(f,w*1.3,h*.8,2,signal,identity,pointer);
  assert.ok(f.x.every(Number.isFinite)&&f.y.every(Number.isFinite));
 }
});
