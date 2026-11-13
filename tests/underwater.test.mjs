import test from 'node:test';
import assert from 'node:assert/strict';
import {drawWorld} from '../js/worlds.js';
import {drawPointer} from '../js/pointer.js';
import {environments} from '../js/environments.js';

function recorder(){
  const commands=[];
  const ctx=new Proxy({}, {
    get:(_,key)=>key.startsWith('create')?(...args)=>{commands.push([key,...args]);return {addColorStop(...values){commands.push(['stop',...values]);}};}:(...args)=>commands.push([key,...args]),
    set:(_,key,value)=>{commands.push([key,value]);return true;}
  });
  return {ctx,commands};
}
function scenery(t,w=900,h=500){
  const record=recorder();
  drawWorld({ctx:record.ctx,w,h,t,ink:(...args)=>JSON.stringify(args),signal:{bass:.5,mid:.4,high:.3,level:.2},preset:environments.underwater,point:(x,y)=>({x,y}),reduced:false});
  return record.commands;
}
test('underwater bubbles vary in depth and ascend smoothly with bounded deterministic drawing',()=>{
  const first=scenery(1),next=scenery(1.02);
  assert.equal(JSON.stringify(first),JSON.stringify(scenery(1)));
  const bubbles=first.filter(c=>c[0]==='ellipse'),later=next.filter(c=>c[0]==='ellipse');
  assert.equal(bubbles.length,68);assert.ok(new Set(bubbles.map(c=>c[3])).size>50);
  for(let i=0;i<68;i++)assert.ok(later[i][2]<bubbles[i][2],'ascent is upward between wrap points');
  for(const [w,h] of [[280,330],[390,570],[1280,570]])for(const t of [0,1,10000]){
    const commands=scenery(t,w,h);assert.ok(commands.length<3000);
    for(const command of commands)for(const n of command)if(typeof n==='number')assert.ok(Number.isFinite(n));
    assert.equal(commands.filter(c=>c[0]==='ellipse').length,68);
  }
});
test('restored underwater crests expand at the exact click position and fade',()=>{
  const pointer={x:.5,y:.5,vx:0,vy:0,strength:0,pulses:[{x:.5,y:.5,time:0}]};
  const draw=(reduced,time=800)=>{const r=recorder();drawPointer(r.ctx,pointer,'underwater',900,500,time,(...a)=>JSON.stringify(a),reduced);return r.commands;};
  const normal=draw(false),reduced=draw(true),early=draw(false,200);
  const rings=commands=>commands.filter(c=>c[0]==='ellipse');
  assert.equal(rings(normal).length,3);assert.equal(normal.filter(c=>c[0]==='arc').length,0);
  for(const ring of rings(normal)){assert.equal(ring[1],450);assert.equal(ring[2],250);}
  assert.ok(rings(normal)[0][3]>rings(early)[0][3]);
  assert.ok(rings(reduced)[0][3]<rings(normal)[0][3]);
  assert.ok(JSON.parse(reduced.find(c=>c[0]==='strokeStyle')[1])[1]<JSON.parse(normal.find(c=>c[0]==='strokeStyle')[1])[1]);
});
