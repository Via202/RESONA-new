// Pointer state is independent of audio. Coordinates are normalized for resizing.
export function createPointerState(){
  const state={x:.5,y:.5,targetX:.5,targetY:.5,vx:0,vy:0,strength:0,inside:false,pulses:[]};
  let previous=null,lastMove=-Infinity,lastFrame=null;
  return {
    move(x,y,time){
      x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));
      if(previous){const dt=Math.max(.008,(time-previous.time)/1000);state.vx=(x-previous.x)/dt;state.vy=(y-previous.y)/dt;
        state.strength=Math.min(1,Math.hypot(state.vx,state.vy)*.35+.08);}
      else {state.x=x;state.y=y;state.strength=.08;}
      state.inside=true;state.targetX=x;state.targetY=y;previous={x,y,time};lastMove=time;
    },
    leave(){state.inside=false;previous=null;},
    click(x,y,time,lifetime=1600){state.pulses.push({x,y,time,lifetime});if(state.pulses.length>12)state.pulses.shift();},
    sample(time){
      const dt=lastFrame===null?0:Math.min(.1,Math.max(0,(time-lastFrame)/1000));lastFrame=time;
      const blend=1-Math.exp(-dt*12);state.x+=(state.targetX-state.x)*blend;state.y+=(state.targetY-state.y)*blend;
      if(!state.inside||time-lastMove>60){const decay=Math.exp(-dt*3.5);state.strength*=decay;state.vx*=decay;state.vy*=decay;}
      state.pulses=state.pulses.filter(p=>time-p.time<p.lifetime);
      return state;
    }
  };
}
export function attachPointer(element,getEnvironment=()=>null){
  const input=createPointerState();let active=null,start=null;
  const position=e=>{const box=element.getBoundingClientRect();return [(e.clientX-box.left)/box.width,(e.clientY-box.top)/box.height];};
  element.addEventListener('pointermove',e=>{if(e.isPrimary===false||e.pointerType==='touch'&&active!==e.pointerId)return;input.move(...position(e),performance.now());});
  element.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button!==0)return;active=e.pointerId;start={x:e.clientX,y:e.clientY};input.move(...position(e),performance.now());});
  element.addEventListener('pointerup',e=>{if(active!==e.pointerId)return;if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<12)input.click(...position(e),performance.now(),getEnvironment()==='cyberpunk'?520:1600);active=null;start=null;if(e.pointerType!=='mouse')input.leave();});
  for(const name of ['pointerleave','pointercancel','lostpointercapture'])element.addEventListener(name,()=>{active=null;start=null;input.leave();});
  window.addEventListener('blur',()=>{active=null;start=null;input.leave();});
  return input;
}

// Add future environment behaviors here; each returns a bounded local offset.
export function createDreamPointer(){return {initialized:false,x:.5,y:.5,strength:0,vx:0,vy:0,inside:false,pulses:[]};}
// A Dreamcore-only visual filter; never mutate the shared input or click positions.
export function updateDreamPointer(state,input,dt){
 if(!input){state.initialized=false;return null;}
 if(!state.initialized){state.x=input.x;state.y=input.y;state.strength=0;state.vx=0;state.vy=0;state.initialized=true;}
 const x=input.targetX??input.x,y=input.targetY??input.y,distance=Math.hypot(x-state.x,y-state.y);
 const step=Math.max(0,Math.min(.1,dt)),tau=.12-Math.min(1,distance*4)*.075,blend=1-Math.exp(-step/tau),energy=1-Math.exp(-step/.14);
 state.x+=(x-state.x)*blend;state.y+=(y-state.y)*blend;
 state.strength+=(input.strength-state.strength)*energy;state.vx+=((input.vx??0)-state.vx)*energy;state.vy+=((input.vy??0)-state.vy)*energy;
 state.inside=input.inside;state.pulses=input.pulses;return state;
}
export const behaviors={
  underwater:(dx,dy,force,time,index)=>{
    const distance=Math.hypot(dx,dy),wave=Math.sin(distance*.038-time*.0016)*force*3;
    return {x:dx*force*.21+dx/Math.max(1,distance)*wave-dy*force*.025,y:dy*force*.21+dy/Math.max(1,distance)*wave*.7+dx*force*.025};
  },
  dreamcore:(dx,dy,force,time,index)=>({x:-dx*force*.28-dy*force*.13+Math.sin(time*.0007+index)*force*3,y:-dy*force*.28+dx*force*.13}),
  cyberpunk:(dx,dy,force,time,index)=>({x:Math.sin(Math.floor(time/90)+index*13)*force*32,y:Math.cos(index*7+Math.floor(time/120))*force*10}),
  space:(dx,dy,force,time,index)=>({x:-dx*force*.32-dy*force*.18,y:-dy*force*.32+dx*force*.18}),
  retro:(dx,dy,force,time,index)=>({x:Math.sin(dy*.055+time*.0017)*force*(5+force*12),y:Math.sin(time*.0008+index)*force*2})
};
export function influence(x,y,width,height,pointer,environment,time,index=0,reduced=false){
  if(!pointer)return {x,y,force:0};
  const dx=x-pointer.x*width,dy=y-pointer.y*height,reach=Math.min(width,height)*.45;
  const force=Math.max(0,1-Math.hypot(dx,dy)/Math.max(1,reach))*pointer.strength*(reduced?.25:1);
  const offset=(behaviors[environment]||behaviors.underwater)(dx,dy,force,reduced?0:time,index);
  return {x:x+offset.x,y:y+offset.y,force};
}
export function drawPointer(ctx,pointer,environment,width,height,time,ink,reduced){
  if(!pointer)return;
  const scale=reduced?.25:1;
  const pulses=pointer.pulses;
  // Fixed count trails, with opacity decaying from the sampled movement strength.
  if(environment==='cyberpunk')drawCyberTrail(ctx,pointer,width,height,time,ink,reduced);
  else if(pointer.strength>.002)for(let i=0;i<4;i++){
    const x=pointer.x*width-pointer.vx*width*i*.018,y=pointer.y*height-pointer.vy*height*i*.018;
    paint(x,y,12+i*8,pointer.strength*.2*scale/(i+1),i);
  }
  for(const pulse of pulses){
    const age=Math.max(0,(time-pulse.time)/1600);
    if(environment==='underwater'&&age>=1)continue;
    if(environment==='retro'||environment==='underwater')paint(pulse.x*width,pulse.y*height,12+age*(reduced?30:130),(1-age)**2*.55*scale,age*5);
    else drawClickBurst(ctx,pulse,environment,width,height,time,ink,reduced);
  }
  function paint(x,y,r,alpha,phase){
    ctx.save();ctx.lineWidth=1;ctx.strokeStyle=ink(0,alpha);
    if(environment==='underwater'){
      // Three phase-offset crests form a receding surface ripple; wider faint
      // strokes soften the edges without a costly full-canvas blur pass.
      for(let crest=0;crest<3;crest++){
        const radius=Math.max(1,r*(1-crest*.19)),opacity=alpha*(1-crest*.24);
        ctx.beginPath();ctx.ellipse(x,y,radius,radius*(.57+Math.sin(phase*.3)*.025),-.08,0,Math.PI*2);
        ctx.strokeStyle=ink(-8,opacity*.24,82);ctx.lineWidth=4;ctx.stroke();
        ctx.strokeStyle=ink(-8,opacity*.85,86);ctx.lineWidth=.85;ctx.stroke();
      }
    }else if(environment==='space'){
      const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,ink(-20,alpha*.4,90));glow.addColorStop(1,ink(-20,0));ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      ctx.beginPath();ctx.ellipse(x,y,r,r*.72,phase*.08,0,Math.PI*2);ctx.strokeStyle=ink(-18,alpha*.65,90);ctx.lineWidth=1;ctx.stroke();
    }else if(environment==='dreamcore'){
      const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,ink(-70,alpha*.5,85));glow.addColorStop(1,ink(25,0));ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      const spectrum=ctx.createLinearGradient(x-r,y-r,x+r,y+r);spectrum.addColorStop(0,ink(-95,alpha*.65,88));spectrum.addColorStop(.5,ink(0,alpha*.4,85));spectrum.addColorStop(1,ink(40,alpha*.65,88));ctx.strokeStyle=spectrum;
      for(let ring=0;ring<2;ring++){ctx.beginPath();ctx.ellipse(x,y,r*(1-ring*.2),r*(.7-ring*.12),phase*.035,0,Math.PI*2);ctx.lineWidth=ring?.7:1.1;ctx.stroke();}
    }else if(environment==='retro'){
      // Thin offset echoes spread and fade like an analog tracking disturbance.
      for(let band=0;band<5;band++){
        ctx.strokeStyle=ink(band%2?-92:45,alpha*.65/(1+band*.25),78);ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x-r*(1+band*.15)+Math.sin(phase+band)*3,y+(band-2)*3);ctx.lineTo(x+r*(1+band*.15),y+(band-2)*3);ctx.stroke();
      }
    }else if(environment==='cyberpunk'){
      for(let channel=0;channel<3;channel++){ctx.strokeStyle=ink(channel*110,alpha);ctx.strokeRect(x-r+channel*4,y-r*.3,r*2,r*.6);}
      ctx.fillStyle=ink(160,alpha*.4);ctx.fillRect(x-r,y+Math.sin(phase)*r,r*2,2);
    }else {ctx.beginPath();ctx.ellipse(x,y,r,r*.55,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
}

// Analytic click effects share the bounded pulse list (1.6 s; Cyberpunk 520 ms).
// No particle arrays, timers or separate loops are created.
const burstSeeds=Array.from({length:12},(_,i)=>({angle:i*2.399,size:.5+(Math.sin(i*31)*.5+.5)*.5}));
export function drawClickBurst(ctx,pulse,environment,width,height,time,ink,reduced=false){
  const age=Math.max(0,Math.min(1,(time-pulse.time)/1600));if(age>=1)return;
  const progress=1-(1-age)**2,fade=(1-age)**2*(reduced?.35:1),motion=reduced?.3:1;
  const x=pulse.x*width,y=pulse.y*height,reach=Math.min(120,Math.min(width,height)*.3)*motion;
  ctx.save();
  if(environment==='dreamcore'){
    for(let i=0;i<7;i++){
      const seed=burstSeeds[i],px=x+Math.cos(seed.angle)*progress*reach*.4+Math.sin(age*3+i)*2*motion,py=y+Math.sin(seed.angle)*progress*reach*.24-progress*reach*.08,r=(10+progress*reach*.45)*seed.size;
      const glow=ctx.createRadialGradient(px-r*.12,py-r*.15,0,px,py,r);
      glow.addColorStop(0,ink(i%2?-100:40,fade*.24,88));glow.addColorStop(.5,ink(i%2?0:35,fade*.12,75));glow.addColorStop(1,ink(0,0));ctx.fillStyle=glow;ctx.fillRect(px-r,py-r,r*2,r*2);
    }
  }else if(environment==='space'){
    const glow=ctx.createRadialGradient(x,y,0,x,y,12+progress*reach*.55);glow.addColorStop(0,ink(-20,fade*.14,85));glow.addColorStop(1,ink(0,0));ctx.fillStyle=glow;const r=12+progress*reach*.55;ctx.fillRect(x-r,y-r,r*2,r*2);
    for(let i=0;i<12;i++){
      const seed=burstSeeds[i],distance=progress*reach*seed.size,px=x+Math.cos(seed.angle)*distance,py=y+Math.sin(seed.angle)*distance;
      ctx.beginPath();ctx.moveTo(x+Math.cos(seed.angle)*distance*.78,y+Math.sin(seed.angle)*distance*.78);ctx.lineTo(px,py);ctx.strokeStyle=ink(-25,fade*.3,88);ctx.lineWidth=.7;ctx.stroke();
      ctx.beginPath();ctx.arc(px,py,.8+seed.size*1.4,0,Math.PI*2);ctx.fillStyle=ink(-20,fade*.8,97);ctx.fill();
    }
  }else if(environment==='cyberpunk'){
    const elapsed=Math.max(0,time-pulse.time);
    // Exactly two contiguous visible windows; brightness glitches never add flashes.
    if(elapsed<180||elapsed>=340&&elapsed<520){
      const tick=reduced?0:Math.floor(elapsed/45),r=Math.min(24,Math.min(width,height)*.06)+(reduced?0:tick%2);
      ctx.strokeStyle=ink(tick%2?172:52,(reduced?.3:.7)*(reduced?1:.8+Math.sin(tick*2)*.15),85);ctx.lineWidth=1;
      ctx.strokeRect(x-r,y-r,r*2,r*2);
    }
  }
  ctx.restore();
}

const cyberTrails=new WeakMap();
export function createCyberTrail(){return {x:new Float64Array(5),y:new Float64Array(5),initialized:false,last:null};}
export function updateCyberTrail(state,pointer,time){
 const dt=state.last===null?0:Math.max(0,Math.min(.1,(time-state.last)/1000));state.last=time;
 const x=pointer.targetX??pointer.x??.5,y=pointer.targetY??pointer.y??.5;
 if(!state.initialized){state.x.fill(x);state.y.fill(y);state.initialized=true;}
 for(let i=0;i<5;i++){const blend=1-Math.exp(-dt/(.035+i*.025));state.x[i]+=(x-state.x[i])*blend;state.y[i]+=(y-state.y[i])*blend;}
 return state;
}
function drawCyberTrail(ctx,pointer,w,h,time,ink,reduced){
 let trail=cyberTrails.get(ctx);if(!trail){trail=createCyberTrail();cyberTrails.set(ctx,trail);}updateCyberTrail(trail,pointer,time);
 if(pointer.strength<=.002)return;
 // Keep the two brief click flashes visually separate from movement rectangles.
 for(const pulse of pointer.pulses)if(time-pulse.time<520)return;
 const amount=Math.min(1,pointer.strength)*(reduced?.25:1),tick=reduced?0:Math.floor(time/85),scale=Math.min(w,h);
 ctx.save();ctx.lineWidth=.8;
 for(let i=0;i<(reduced?3:5);i++){
  const flicker=reduced?1:.65+Math.sin(time*.007+i*2)*.3,width=Math.min(65,scale*(.045+i*.015)),height=Math.min(23,scale*(.012+i%3*.01));
  const shift=reduced?0:Math.sin(tick+i*7)*(3+i*2),x=trail.x[i]*w-width*.5+shift,y=trail.y[i]*h-height*.5+(i-2)*7;
  if(i===0&&!reduced){ctx.save();ctx.globalCompositeOperation='difference';ctx.fillStyle=ink(52,amount*.08,85);ctx.fillRect(x,y,width,height);ctx.restore();}
  ctx.strokeStyle=ink(i%2?52:0,amount*flicker*.45,78);ctx.strokeRect(x,y,width,height);
  if(i%2===1){ctx.strokeStyle=ink(172,amount*flicker*.22,78);ctx.strokeRect(x+3,y-1,width,height);}
  ctx.fillStyle=ink(52,amount*flicker*.28,88);ctx.fillRect(x+shift,y+height*.6,width*.45,1);
 }
 ctx.restore();
}
