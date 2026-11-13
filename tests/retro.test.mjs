import test from 'node:test';
import assert from 'node:assert/strict';
import {createRetroGrid,updateRetroGrid,drawForeground,retroHorizon,createRetroResponse,updateRetroResponse} from '../js/worlds.js';
import {environments} from '../js/environments.js';
const identity=(x,y)=>({x,y}),quiet={bass:0,mid:0,high:0,level:0};
test('retro perspective grid is ordered, converges at the horizon and reuses vertices',()=>{
 for(const [w,h] of [[280,330],[390,570],[1280,570]])for(const t of [0,.1,10,10000]){
  const grid=createRetroGrid();assert.equal(updateRetroGrid(grid,w,h,t,quiet,identity),grid);assert.equal(grid.length,510);
  for(const n of grid)assert.ok(Number.isFinite(n));
  const vp=retroHorizon(w,h);
  for(let col=0;col<17;col++){assert.equal(grid[col*2],vp.x);assert.equal(grid[col*2+1],vp.y);}
  for(let row=1;row<15;row++)for(let col=1;col<17;col++)assert.ok(grid[(row*17+col)*2]>grid[(row*17+col-1)*2]);
  for(let col=0;col<17;col++){
   const slope=(grid[(17+col)*2]-vp.x)/(grid[(17+col)*2+1]-vp.y);
   for(let row=2;row<15;row++)assert.ok(Math.abs((grid[(row*17+col)*2]-vp.x)/(grid[(row*17+col)*2+1]-vp.y)-slope)<1e-10);
  }
  for(let row=1;row<15;row++)assert.ok(grid[(row*17+8)*2+1]>grid[((row-1)*17+8)*2+1]);
  const farWidth=grid[16*2]-grid[0],nearWidth=grid[(14*17+16)*2]-grid[(14*17)*2];assert.ok(nearWidth>farWidth*5);
  const snapshot=Array.from(grid);updateRetroGrid(grid,w,h,t,quiet,identity);assert.deepEqual(Array.from(grid),snapshot);
 }
});
test('deformation and pointer input cannot move the shared vanishing point',()=>{
 for(const [w,h] of [[280,330],[1280,570],[1000,250]]){
  const v=updateRetroGrid(createRetroGrid(),w,h,12,{bass:1,mid:1,high:1,level:1},(x,y)=>({x:x+100,y:y+50}));
  const vp=retroHorizon(w,h);assert.equal(vp.y/h,.56);assert.equal(vp.x/w,.5);
  for(let col=0;col<17;col++){assert.equal(v[col*2],vp.x);assert.equal(v[col*2+1],vp.y);}
 }
});
test('Retro visual response is bounded, monotonic and smooth with fast attack and slower release',()=>{
 const state=createRetroResponse(),loud={bass:1,mid:1,high:1,level:1};
 updateRetroResponse(state,loud,1/60);
 for(const band of Object.keys(quiet))assert.ok(state[band]>0&&state[band]<.4);
 for(let i=0;i<300;i++)updateRetroResponse(state,loud,1/60);
 for(const band of Object.keys(quiet))assert.ok(state[band]>.8&&state[band]<1);
 const before=state.bass;updateRetroResponse(state,quiet,1/60);assert.ok(state.bass>before*.85&&state.bass<before);
 for(let i=0;i<300;i++)updateRetroResponse(state,quiet,1/60);assert.ok(state.bass<1e-6);
 const soft=createRetroResponse(),medium=createRetroResponse();
 for(let i=0;i<300;i++){
  updateRetroResponse(soft,{bass:.02,mid:.005,high:.0005,level:.003},1/60);
  updateRetroResponse(medium,{bass:.4,mid:.4,high:.4,level:.4},1/60);
 }
 for(const band of Object.keys(quiet)){assert.ok(soft[band]>0&&soft[band]<.08);assert.ok(medium[band]>soft[band]);}
});
test('response smoothing is frame-rate independent at equal elapsed time',()=>{
 const a=createRetroResponse(),b=createRetroResponse(),signal={bass:.5,mid:.4,high:.2,level:.3};
 for(let i=0;i<60;i++)updateRetroResponse(a,signal,1/60);
 for(let i=0;i<120;i++)updateRetroResponse(b,signal,1/120);
 for(const band of Object.keys(quiet))assert.ok(Math.abs(a[band]-b[band])<1e-12);
});
test('retro motion, bass, mids and pointer deformation affect the same bounded grid',()=>{
 const baseline=updateRetroGrid(createRetroGrid(),900,500,1,quiet,identity);
 for(const signal of [{...quiet,bass:1},{...quiet,mid:1}]){
  const active=updateRetroGrid(createRetroGrid(),900,500,1,signal,identity);assert.notDeepEqual(active,baseline);
  for(let row=1;row<15;row++)for(let col=0;col<17;col++)assert.ok(active[(row*17+col)*2+1]>active[((row-1)*17+col)*2+1]);
 }
 assert.notDeepEqual(updateRetroGrid(createRetroGrid(),900,500,2,quiet,identity),baseline);
 assert.notDeepEqual(updateRetroGrid(createRetroGrid(),900,500,1,quiet,(x,y)=>({x:x+3,y})),baseline);
});
test('CRT overlay remains bounded and deterministic with reduced motion',()=>{
 const commands=[];const ctx=new Proxy({}, {get:(_,key)=>key.startsWith('create')?()=>({addColorStop(){}}):(...args)=>commands.push([key,...args]),set:(_,key,value)=>{commands.push([key,value]);return true;}});
 const f={ctx,w:900,h:500,t:14,point:identity,signal:quiet,preset:environments.retro,ink:(...a)=>JSON.stringify(a),reduced:true,pointer:{x:.5,y:.5,strength:1}};
 drawForeground(f);const baseline=JSON.stringify(commands);assert.ok(commands.length<700);commands.length=0;drawForeground(f);assert.equal(JSON.stringify(commands),baseline);
 assert.ok(!commands.some(c=>['drawImage','getImageData','putImageData'].includes(c[0])));
});
