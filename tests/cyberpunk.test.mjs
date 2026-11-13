import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createField,createParticleRenderer,modes,passAt,orderedPixel} from '../js/cyber-field.js';
import {createFrameCycle,framePhase,updateCyberAudio} from '../js/cyber-hud.js';
import {drawWorld,drawForeground} from '../js/worlds.js';
import {createCyberTrail,updateCyberTrail,drawPointer} from '../js/pointer.js';
import {environments} from '../js/environments.js';

function recorder(){
 const commands=[];const ctx=new Proxy({}, {get:(_,key)=>(...a)=>{commands.push([key,...a]);if(key.startsWith('create'))return {addColorStop:(...v)=>commands.push(['stop',...v])};},set:(_,key,value)=>{commands.push([key,value]);return true;}});return {commands,ctx};
}

test('experience markup contains the new HUD and only whitespace before the monitor',()=>{
 const page=readFileSync(new URL('../experience.html',import.meta.url),'utf8');
 assert.match(page,/<section id="cyber-hud"/);
 assert.match(page,/<\/section>\s+<section class="stage"/);
 assert.doesNotMatch(page,/cyber-lab|<\/section>n<section/);
 assert.equal((page.match(/<canvas\b/g)||[]).length,1);
});

test('HUD schedules staggered anchor, trace, readout, retraction and quiet intervals',()=>{
 const first=createFrameCycle(0), second=createFrameCycle(1);
 assert.ok(framePhase(first,.12,false).anchor>0);
 assert.equal(framePhase(second,.12,false).anchor,0);
 assert.ok(framePhase(first,.45,false).trace>0);
 assert.equal(framePhase(first,.45,false).info,0);
 assert.deepEqual(framePhase(first,1.1,false),{trace:1,info:1,anchor:0});
 const fading=framePhase(first,5.1,false);
 assert.equal(fading.info,0);
 assert.ok(fading.trace>0&&fading.trace<1);
 assert.deepEqual(framePhase(first,5.55,false),{trace:0,info:0,anchor:0});
 assert.ok(first.start-5.55>=2&&first.start-5.55<=5);
 assert.ok(first.hold>=4&&first.hold<=7);
});

test('sphere stays inset across sizes and hue changes use the same geometry on a shared surface',()=>{
 const {ctx,commands}=recorder();
 const canvas={width:2000,height:1000,getContext:()=>ctx};
 const renderer=createParticleRenderer(canvas);
 const signal={bass:1,mid:1,high:1,level:1};
 const pointer={x:.96,y:.04,strength:1,pulses:[{x:.96,y:.04,time:900,lifetime:520}]};
 for(const [w,h] of [[280,260],[760,490],[1300,590]]){
  for(const seconds of [0,2,10,26]){
   commands.length=0;
   renderer.render(seconds,signal,pointer,1000,{mode:0,blend:0},false,138,{w,h});
   const points=commands.filter(c=>c[0]==='rect');
   assert.ok(points.length>1000);
   assert.ok(points.every(([,x,y,dx,dy])=>x>=0&&y>=0&&x+dx<=w&&y+dy<=h));
   commands.length=0;
   renderer.render(seconds,signal,pointer,1000,{mode:0,blend:0},false,228,{w,h});
   assert.deepEqual(commands.filter(c=>c[0]==='rect'),points);
   assert.ok(commands.some(c=>c[0]==='fillStyle'&&c[1].startsWith('hsl(228,')));
   assert.ok(!commands.some(c=>c[0]==='setTransform'));
   assert.equal(canvas.width,2000);
  }
 }
});

const quiet = {bass:0,mid:0,high:0,level:0};
const stillPointer = {x:.5,y:.5,strength:0,pulses:[]};
const particlePass = {mode:0,blend:0};

test('quiet live audio attacks smoothly and suspended or silent input releases to idle',()=>{
 const envelope={...quiet};
 const track={bass:.08,mid:.04,high:.008,level:.008};
 updateCyberAudio(envelope,track,true,16);
 assert.ok(envelope.level>0&&envelope.level<.08);
 const initial=envelope.level;
 for(let i=0;i<25;i++)updateCyberAudio(envelope,track,true,16);
 assert.ok(envelope.level>initial&&envelope.level>.2);
 const active=envelope.level;
 updateCyberAudio(envelope,track,false,16);
 assert.ok(envelope.level<active&&envelope.level>active*.9);
 for(let i=0;i<160;i++)updateCyberAudio(envelope,{...track,level:0},true,16);
 assert.deepEqual(envelope,quiet);
});

test('idle geometry remains spherical while bass expands, mids twist and highs brighten the field',()=>{
 const field=createField(4200);
 for(let i=0;i<field.length;i+=5)assert.ok(Math.abs(Math.hypot(field[i],field[i+1],field[i+2])-1)<1e-6);
 const {ctx,commands}=recorder();
 const renderer=createParticleRenderer({getContext:()=>ctx});
 const surface={w:1100,h:580};
 const points=(signal,time)=>{
  commands.length=0;
  renderer.render(time,signal,stillPointer,time*1000,particlePass,false,138,surface);
  return commands.filter(command=>command[0]==='rect');
 };
 const meanRadius=points=>points.reduce((sum,[,x,y])=>sum+Math.hypot(x-550,y-290),0)/points.length;
 const meanSize=points=>points.reduce((sum,point)=>sum+point[3],0)/points.length;
 const idle=points(quiet,1);
 const rotated=points(quiet,3);
 assert.notDeepEqual(idle,rotated);
 assert.ok(Math.abs(meanRadius(idle)-meanRadius(rotated))<3);
 assert.ok(meanRadius(points({...quiet,bass:.75},1))>meanRadius(idle)*1.18);
 const mids=points({...quiet,mid:.7},1);
 assert.notDeepEqual(mids,idle);
 assert.ok(Math.abs(meanRadius(mids)-meanRadius(idle))<15);
 const highs=points({...quiet,high:.7},1);
 assert.ok(meanSize(highs)>meanSize(idle)*1.05);
 assert.ok(Math.abs(meanRadius(highs)-meanRadius(idle))<4);
});

test('interference consists of bounded short bursts with more activity during music',()=>{
 function observe(signal,reduced=false){
  let segments=[];
  const ctx=new Proxy({}, {get:(_,key)=>key==='fillRect'?(...args)=>segments.push(args):()=>{},set:()=>true});
  const renderer=createParticleRenderer({getContext:()=>ctx});
  const surface={w:360,h:300};
  let visible=0,quietFrames=0;
  for(let i=0;i<260;i++){
   segments=[];
   renderer.render(i*.05,signal,stillPointer,i*50,particlePass,reduced,138,surface);
   const lines=segments.slice(1);
   if(lines.length)visible++;else quietFrames++;
   assert.ok(lines.length<=10);
   assert.ok(lines.every(([x,y,w,h])=>x>=0&&y>=0&&x+w<=surface.w&&y+h<=surface.h&&h<=3));
  }
  return {visible,quietFrames};
 }
 const idle=observe(quiet),active=observe({...quiet,level:.9,high:.7});
 assert.ok(idle.visible>0&&idle.quietFrames>240);
 assert.ok(active.visible>idle.visible&&active.quietFrames>190);
 assert.equal(observe({...quiet,level:1},true).visible,0);
});

test('the seeded field spans three dimensions and the cycle uses ordered brightness thresholds',()=>{
 const field=createField(200);
 assert.deepEqual(field,createField(200));
 for(let axis=0;axis<3;axis++){
  const values=field.filter((_,index)=>index%5===axis);
  assert.ok(Math.max(...values)-Math.min(...values)>.4);
 }
 assert.deepEqual([0,2.6,5.2,7.81].map(seconds=>modes[passAt(seconds,false).mode]),['Particle','Dithering','ASCII','Particle']);
 assert.ok(passAt(2.5,false).blend>passAt(2.3,false).blend);
 assert.deepEqual(passAt(50,true),{mode:0,blend:0});
 const pixels=Array.from({length:16},(_,i)=>orderedPixel(i%4,Math.floor(i/4),.5));
 assert.equal(pixels.filter(Boolean).length,8);
});

test('each pass draws the shared particle field, including glyphs and a localized scan',()=>{
 const {ctx,commands}=recorder();
 const canvas={clientWidth:480,clientHeight:420,getContext:()=>ctx};
 const renderer=createParticleRenderer(canvas);
 const input={x:.5,y:.5,strength:.8,pulses:[{x:.5,y:.5,time:900,lifetime:520}]};
 const signal={bass:.6,mid:.3,high:.2,level:.4};
 for(const [mode,operation] of ['rect','fillRect','fillText'].entries()){
  commands.length=0;
  assert.equal(renderer.render(1,signal,input,1000,{mode,blend:0},false),4200);
  assert.ok(commands.filter(command=>command[0]===operation).length>10);
  assert.ok(commands.some(command=>command[0]==='arc' && command[1]===240 && command[2]===210));
  assert.ok(commands.every(command=>command.slice(1).every(value=>typeof value!=='number'||Number.isFinite(value))));
 }
});

test('the separate Cyberpunk monitor receives no legacy world or foreground scenery',()=>{
 const {commands,ctx}=recorder();
 const frame={ctx,w:900,h:500,preset:environments.cyberpunk};
 drawWorld(frame);
 drawForeground(frame);
 assert.deepEqual(commands,[]);
});

test('cursor rectangles have bounded reusable lag positions, local difference blending and fade at rest',()=>{
 const trail=createCyberTrail(),x=trail.x,p={x:.2,y:.3,targetX:.2,targetY:.3,strength:.8,pulses:[]};updateCyberTrail(trail,p,0);p.targetX=.8;updateCyberTrail(trail,p,16);
 assert.equal(trail.x,x);assert.ok(trail.x[0]>trail.x[4]);assert.ok(trail.x.every(n=>n>.2&&n<.8));
 for(let i=2;i<200;i++)updateCyberTrail(trail,p,i*16);assert.ok(Math.abs(trail.x[4]-.8)<1e-8);
 for(const reduced of [false,true]){
  const {ctx,commands}=recorder();drawPointer(ctx,p,'cyberpunk',900,500,1000,(...v)=>JSON.stringify(v),reduced);
  assert.ok(commands.filter(c=>c[0]==='strokeRect').length<=7);
  assert.equal(commands.filter(c=>c[0]==='globalCompositeOperation'&&c[1]==='difference').length,reduced?0:1);
  assert.ok(commands.filter(c=>c[0]==='fillRect').every(c=>c[3]<=65&&c[4]<=23));
  commands.length=0;drawPointer(ctx,{...p,strength:0},'cyberpunk',900,500,2000,()=>'',reduced);assert.equal(commands.length,0);
 }
});
test('target flashes stay distinct from movement rectangles and retain exact two-window timing',()=>{
 let appearances=0,previous=false;
 for(let time=0;time<520;time+=10){
  const {ctx,commands}=recorder();drawPointer(ctx,{x:.3,y:.7,strength:1,pulses:[{x:.3,y:.7,time:0}]},'cyberpunk',900,500,time,(...v)=>JSON.stringify(v),false);
  const rects=commands.filter(c=>c[0]==='strokeRect');assert.ok(rects.length<=1);const visible=rects.length>0;if(visible&&!previous)appearances++;previous=visible;
  for(const [,x,y,w,h] of rects){assert.equal(x+w/2,270);assert.equal(y+h/2,350);assert.equal(w,h);}
 }
 assert.equal(appearances,2);
});
