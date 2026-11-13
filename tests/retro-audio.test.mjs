import test from 'node:test';
import assert from 'node:assert/strict';
import {drawWorld,drawForeground,createRetroResponse,updateRetroResponse,updateRetroGrid,createRetroGrid,retroHorizon} from '../js/worlds.js';
import {environments} from '../js/environments.js';
const quiet={bass:.02,mid:.005,high:.0005,level:.003};
const loud={bass:.5,mid:.15,high:.025,level:.12};
function render(signal){
 const commands=[];
 const ctx=new Proxy({}, {get:(_,key)=>key.startsWith('create')?(...a)=>{commands.push([key,...a]);return {addColorStop(...v){commands.push(['stop',...v]);}};}:(...a)=>commands.push([key,...a]),set:(_,key,value)=>{commands.push([key,value]);return true;}});
 const f={ctx,w:900,h:500,t:14,dt:1/60,signal,point:(x,y)=>({x,y}),preset:environments.retro,ink:(offset,alpha=1,light=65)=>JSON.stringify({offset,alpha,light}),reduced:false,pointer:null};
 for(let i=0;i<180;i++){commands.length=0;drawWorld(f);}
 drawForeground(f);return commands;
}
test('stationary-pointer background has visible geometric and lighting response at realistic signal ranges',()=>{
 const soft=render(quiet),strong=render(loud);
 const radius=commands=>commands.find(c=>c[0]==='arc')[3];
 assert.ok(radius(strong)-radius(soft)>3,'sun radius changes by more than 3 CSS pixels');
 const mountains=commands=>commands.filter(c=>c[0]==='lineTo').slice(0,25);
 const a=mountains(soft),b=mountains(strong);assert.ok(Math.max(...a.map((p,i)=>Math.abs(p[2]-b[i][2])))>3,'mountain peaks move more than 3 CSS pixels');
 const glow=commands=>commands.filter(c=>c[0]==='stop'&&c[1]===0).map(c=>{try{return JSON.parse(c[2]);}catch{return null;}}).find(c=>c?.offset===20-environments.retro.hue).alpha;
 assert.ok(glow(strong)-glow(soft)>.1,'atmospheric glow opacity changes visibly');
});
test('each band independently drives its intended environmental output',()=>{
 const zero={bass:0,mid:0,high:0,level:0},base=render(zero);
 for(const band of Object.keys(zero)){
  const active=render({...zero,[band]:loud[band]});assert.notEqual(JSON.stringify(active),JSON.stringify(base),band);
 }
 const soft=createRetroResponse(),strong=createRetroResponse();for(let i=0;i<180;i++){updateRetroResponse(soft,quiet,1/60);updateRetroResponse(strong,loud,1/60);}
 const project=s=>updateRetroGrid(createRetroGrid(),900,500,2,s,(x,y)=>({x,y}));const a=project(soft),b=project(strong);
 assert.ok(Math.max(...a.map((n,i)=>i%2?Math.abs(n-b[i]):0))>10,'floor movement exceeds 10 CSS pixels');
 const vp=retroHorizon(900,500);for(let col=0;col<17;col++){assert.equal(b[col*2],vp.x);assert.equal(b[col*2+1],vp.y);}
 const tracking=commands=>commands.filter(c=>c[0]==='fillStyle'&&typeof c[1]==='string').map(c=>{try{return JSON.parse(c[1]);}catch{return null;}}).filter(c=>c?.offset===190-environments.retro.hue).map(c=>c.alpha);
 assert.ok(Math.max(...tracking(render({...zero,high:.025})))-Math.max(...tracking(base))>.03,'high frequencies strengthen the existing tracking seam');
});
