// Scenery and rendering language are independent. Bounded procedural layers
// compose backgrounds, midground focal objects and foreground atmosphere.
export function drawWorld(f){
  const {ctx:c,w,h,t,ink,signal:s,preset,pointer,reduced,point}=f;
  const id=preset.id;
  const glow=(x,y,r,color,alpha)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,ink(color,alpha,75));g.addColorStop(1,ink(color,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
  if(id==='underwater'){
    drawUnderwater(f);
  }else if(id==='dreamcore'){
    drawDreamcore(f);
  }else if(id==='space'){
    drawSpace(f);
  }else if(id==='retro'){
    drawRetro(f);
  }
}
export function drawForeground(f){
  const {ctx:c,w,h,ink,t,point,signal:s,preset}=f;
  if(preset.id==='cyberpunk')return;
  const drift=preset.id==='space'?1.65:1;
  for(let i=0;i<26;i++){
    const p=point((Math.sin(i*47)*.5+.5)*w,((i*71-t*drift*(5+i%4*4))%h+h)%h,i);
    c.beginPath();c.arc(p.x,p.y,.6+(i%4)*.55+s.high*2,0,Math.PI*2);c.fillStyle=ink(preset.id==='retro'?140:20,(preset.id==='underwater'?.2:.12)+i%3*.07,88);c.fill();
  }
  if(preset.id==='underwater'){
    // Sparse near-camera motes: larger, brighter and faster than distant dust.
    for(let i=0;i<12;i++){
      const x=(waterSeed(i+850)*w+Math.sin(t*.17+i)*12),y=((waterSeed(i+960)*h-t*(9+i%4*3))%h+h)%h,p=point(x,y,i);
      c.beginPath();c.arc(p.x,p.y,1.1+(i%3)*.7,0,Math.PI*2);c.fillStyle=ink(-8,.18+i%3*.06,89);c.fill();
    }
  }
  if(preset.id==='retro')drawRetroOverlay(f);
  if(preset.id==='dreamcore')drawDreamForeground(f);
  const shade=c.createRadialGradient(w*.5,h*.45,h*.15,w*.5,h*.5,Math.max(w,h)*.65);shade.addColorStop(0,'#00000000');shade.addColorStop(1,preset.id==='dreamcore'?'rgba(102,119,172,.12)':'#00000099');c.fillStyle=shade;c.fillRect(0,0,w,h);
}

// Stable seeds are computed once, not generated or allocated during animation.
const waterSeed=n=>{const x=Math.sin(n*127.13+43.7)*43758.5453;return x-Math.floor(x);};
const waterBubbles=Array.from({length:68},(_,i)=>{
 const depth=waterSeed(i+2);
 return {x:waterSeed(i+11),phase:waterSeed(i+109),depth,r:.45+depth*depth*8.5,speed:3+depth*depth*19+waterSeed(i+211)*4,sway:waterSeed(i+320)*Math.PI*2};
});

function drawUnderwater(f){
 const {ctx:c,w,h,t,ink,signal:s,point}=f;
 if(w<=0||h<=0)return;
 // Depth wash and a wide, diffuse surface glow establish water before shapes.
 const depth=c.createLinearGradient(0,0,0,h);
 depth.addColorStop(0,ink(-5,.24,35));depth.addColorStop(.4,ink(18,.36,12));depth.addColorStop(1,ink(30,.72,4));
 c.fillStyle=depth;c.fillRect(0,0,w,h);
 const light=.095+Math.min(.035,s.level*.07+s.high*.018);
 const surface=c.createRadialGradient(w*.38,-h*.2,0,w*.38,-h*.2,w*.8);
 surface.addColorStop(0,ink(-12,.27+s.level*.04,78));surface.addColorStop(1,ink(0,0));c.fillStyle=surface;c.fillRect(0,0,w,h);
 // Localized haze catches the light without brightening the whole depth wash.
 for(let layer=0;layer<2;layer++){
   const x=w*(.22+layer*.47)+Math.sin(t*.09+layer)*w*.03,y=h*(.32+layer*.23),r=Math.max(w,h)*(.34-layer*.06);
   const haze=c.createRadialGradient(x,y,0,x,y,r);haze.addColorStop(0,ink(layer?15:-10,.095,49));haze.addColorStop(1,ink(0,0));c.fillStyle=haze;c.fillRect(x-r,y-r,r*2,r*2);
 }
 // Feathered shafts have transparent edges, not hard triangular boundaries.
 for(let i=0;i<6;i++){
   const drift=Math.sin(t*.16+i*2.3),x=w*(-.08+i*.23)+drift*w*.025,spread=w*(.09+waterSeed(i+410)*.05),lean=w*(.08+Math.sin(i)*.06);
   const beam=c.createLinearGradient(x-spread,0,x+spread*2,0);
   beam.addColorStop(0,ink(-8,0));beam.addColorStop(.45,ink(-8,light,85));beam.addColorStop(.65,ink(-8,light*.5,80));beam.addColorStop(1,ink(-8,0));
   c.beginPath();c.moveTo(x-spread*.25,-10);c.lineTo(x+spread*.25,-10);c.lineTo(x+lean+spread*2,h);c.lineTo(x+lean-spread,h);c.closePath();c.fillStyle=beam;c.fill();
 }
 // Slowly warped, overlapping cells suggest refracted surface caustics.
 // Each cell is a closed curve; the broad faint stroke acts as a soft halo.
 for(let row=0;row<3;row++)for(let cell=0;cell<5;cell++){
   const seed=row*5+cell,cx=w*(cell*.26+(row%2)*.13)+Math.sin(t*.12+seed)*w*.035+(waterSeed(seed+440)-.5)*w*.07,cy=h*(.12+row*.27)+(waterSeed(seed+470)-.5)*h*.08;
   c.beginPath();for(let j=0;j<=32;j++){
     const a=j/32*Math.PI*2,warp=1+Math.sin(a*3+t*.24+seed)*.15+Math.cos(a*5-t*.14+seed)*.08;
     const x=cx+Math.cos(a)*w*.16*warp,y=cy+Math.sin(a)*h*.105*warp;
     j?c.lineTo(x,y):c.moveTo(x,y);
   }
   c.closePath();c.fillStyle=ink(-10,light*.19,68);c.fill();
   c.strokeStyle=ink(-8,light*.4,82);c.lineWidth=10;c.stroke();
   c.strokeStyle=ink(-8,light*.95,85);c.lineWidth=1.1;c.stroke();
 }
 // Independent current layers: slow back layers, faster translucent foreground.
 for(let layer=0;layer<6;layer++){
   const z=layer/5,base=h*(.35+z*.53),flow=t*(.13+z*.16),thickness=h*(.008+z*.013+s.bass*(.008+z*.012));
   c.beginPath();
   for(let edge=0;edge<2;edge++)for(let j=0;j<=48;j++){
     const u=edge?1-j/48:j/48,x=u*w;
     const y=base+Math.sin(u*6+flow+layer)*h*(.025+s.mid*.018)+Math.sin(u*13-flow*.7+layer)*h*(.008+s.mid*.012)+(edge?1:-1)*thickness;
     const p=point(x,y,layer);j===0&&edge===0?c.moveTo(p.x,p.y):c.lineTo(p.x,p.y);
   }
   c.closePath();const water=c.createLinearGradient(0,base-thickness*3,0,base+thickness*3);
   water.addColorStop(0,ink(-6+layer*3,0,70));water.addColorStop(.5,ink(-6+layer*3,.045+z*.035+s.level*.025,60));water.addColorStop(1,ink(18,0,30));
   c.fillStyle=water;c.fill();c.strokeStyle=ink(3,.025+z*.025+s.high*.02,76);c.lineWidth=.7;c.stroke();
 }
 // Irregular seeds, depth-dependent ascent and slow lateral drift. Wrap occurs
 // outside the viewport and edge opacity fades, avoiding visible teleportation.
 for(let i=0;i<waterBubbles.length;i++){
   const b=waterBubbles[i],r=b.r*(.85+Math.min(w,h)/1600),span=h+r*6;
   const rise=t*b.speed+Math.sin(t*.32+b.sway)*(1+b.depth*2);
   const y=((b.phase*span-rise)%span+span)%span-r*3;
   const x=b.x*w+Math.sin(t*(.16+b.depth*.12)+b.sway)*(4+b.depth*13)+Math.sin(t*.37+b.sway*2)*b.depth*4;
   const p=point(x,y,i),edge=Math.max(0,Math.min(1,(y+r*2)/(r*5),(h+r*2-y)/(r*5))),alpha=(.04+b.depth*b.depth*.38)*edge;
   c.beginPath();c.ellipse(p.x,p.y,r,r*(1.05+Math.sin(t*.5+b.sway)*.04),Math.sin(t*.2+b.sway)*.08,0,Math.PI*2);
   c.fillStyle=ink(-5,alpha*.1,75);c.fill();c.strokeStyle=ink(-3,alpha,80);c.lineWidth=b.depth>.65?1:.65;c.stroke();
   if(b.depth>.6){c.beginPath();c.arc(p.x-r*.12,p.y-r*.12,r*.72,Math.PI*1.12,Math.PI*1.63);c.strokeStyle=ink(-8,alpha*.7,92);c.stroke();}
 }
}

const spaceSeed=n=>{const x=Math.sin(n*91.73+8.4)*19341.71;return x-Math.floor(x);};
const spaceStars=Array.from({length:72},(_,i)=>({x:.045+spaceSeed(i+1)*.91,y:.07+spaceSeed(i+137)*.86,depth:.25+spaceSeed(i+272)*.75,phase:spaceSeed(i+409)*Math.PI*2}));
const spaceFields=new WeakMap();
const spaceDistant=Array.from({length:96},(_,i)=>({x:spaceSeed(i+500),y:spaceSeed(i+700),depth:.2+(i%3)*.12,alpha:.18+spaceSeed(i+900)*.28}));
const spaceOrbitAngles=[-.35,.47,1.05],spaceOrbitRates=[.07,-.05,.038];
// Buffers belong to a Canvas context and are reused on every frame and resize.
export function createSpaceField(){return {x:new Float64Array(72),y:new Float64Array(72),offsetX:new Float64Array(72),offsetY:new Float64Array(72),width:0,height:0,degree:new Uint8Array(72),from:new Uint8Array(90),to:new Uint8Array(90),opacity:new Float64Array(90),count:0,checks:0,range:0};}
export function updateSpaceField(field,w,h,t,signal,point,pointer=null,dt=1/60,reduced=false){
 if(field.width>0&&field.height>0&&(w!==field.width||h!==field.height))for(let i=0;i<72;i++){field.offsetX[i]*=w/field.width;field.offsetY[i]*=h/field.height;}
 field.width=w;field.height=h;
 const radius=Math.max(1,Math.min(w,h)*.38),active=pointer?.inside===true;
 const blend=1-Math.exp(-Math.max(0,Math.min(.1,dt))/(active?.14:.45));
 for(let i=0;i<72;i++){
   const star=spaceStars[i],phase=t*(.13+star.depth*.095)+star.phase;
   const x=w*.5+(star.x-.5)*w*(1+signal.bass*.045)+Math.sin(phase)*(6+star.depth*14+signal.mid*4);
   const y=h*.5+(star.y-.5)*h*(1+signal.bass*.045)+Math.cos(phase*.7)*(4+star.depth*9+signal.mid*3);
   if(pointer){
     const dx=pointer.x*w-x,dy=pointer.y*h-y,falloff=active?Math.max(0,1-Math.hypot(dx,dy)/radius):0;
     const pull=falloff*(.48+star.depth*.22)*(reduced?.2:1);
     field.offsetX[i]+=(dx*pull-field.offsetX[i])*blend;field.offsetY[i]+=(dy*pull-field.offsetY[i])*blend;
     field.x[i]=x+field.offsetX[i];field.y[i]=y+field.offsetY[i];
   }else {const p=point(x,y,i);field.x[i]=p.x;field.y[i]=p.y;}
 }
 field.degree.fill(0);field.count=0;field.checks=0;
 const range=Math.max(48,Math.min(145,Math.min(w,h)*.27));field.range=range;
 // At most two new nearest-neighbor edges per node, three edges touching a
 // node, and 90 edges overall. No per-frame sorting or candidate arrays.
 for(let i=0;i<72&&field.count<90;i++){
   let previous=-1;
   for(let attempt=0;attempt<2&&field.degree[i]<3&&field.count<90;attempt++){
     let nearest=-1,best=range*range;
     for(let j=i+1;j<72;j++){
       field.checks++;if(j===previous||field.degree[j]>=3)continue;
       const dx=field.x[i]-field.x[j],dy=field.y[i]-field.y[j],distance=dx*dx+dy*dy;
       if(distance<best){best=distance;nearest=j;}
     }
     if(nearest<0)break;
     const edge=field.count++;field.from[edge]=i;field.to[edge]=nearest;
     field.opacity[edge]=(1-Math.sqrt(best)/range)**1.35;
     field.degree[i]++;field.degree[nearest]++;previous=nearest;
   }
 }
 return field;
}
function drawSpace(f){
 const {ctx:c,w,h,t,signal:s,ink,point,reduced}=f;if(w<=0||h<=0)return;
 // Tiny distant stars sit behind translucent cloud lobes.
 for(let i=0;i<96;i++){
   const star=spaceDistant[i],d=star.depth,x=(star.x*w+t*d*2.2)%w,y=star.y*h;
   c.fillStyle=ink(-15,star.alpha,94);c.fillRect(x,y,.6+d,.6+d);
 }
 for(let layer=0;layer<5;layer++){
   const x=w*(.12+layer*.18)+Math.sin(t*(.02+layer*.008)+layer)*w*.025,y=h*(.32+Math.sin(layer*1.9)*.2),r=Math.max(w,h)*(.22+layer%2*.07);
   const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,ink(layer%2?35:-22,.085+s.level*.025,58));g.addColorStop(.45,ink(layer%2?40:-15,.035,38));g.addColorStop(1,ink(0,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
 }
 let field=spaceFields.get(c);if(!field){field=createSpaceField();spaceFields.set(c,field);}
 updateSpaceField(field,w,h,t,s,point,f.pointer,f.dt??1/60,reduced);
 c.lineWidth=.65;
 for(let edge=0;edge<field.count;edge++){
   const a=field.from[edge],b=field.to[edge];c.beginPath();c.moveTo(field.x[a],field.y[a]);c.lineTo(field.x[b],field.y[b]);c.strokeStyle=ink(-20,field.opacity[edge]*(.34+s.level*.16),83);c.stroke();
 }
 for(let i=0;i<72;i++){
   const star=spaceStars[i],r=.65+star.depth*1.45,twinkle=reduced?1:.9+Math.sin(t*(.4+star.depth*.2)+star.phase)*.1;
   const alpha=(.35+star.depth*.35+s.high*.14+s.level*.15)*twinkle;
   if(star.depth>.6){c.beginPath();c.arc(field.x[i],field.y[i],r*3,0,Math.PI*2);c.fillStyle=ink(-18,alpha*.065,80);c.fill();}
   c.beginPath();c.arc(field.x[i],field.y[i],r,0,Math.PI*2);c.fillStyle=ink(-22,alpha,96);c.fill();
   if(star.depth>.9){c.strokeStyle=ink(-15,alpha*.28,94);c.beginPath();c.moveTo(field.x[i]-r*3,field.y[i]);c.lineTo(field.x[i]+r*3,field.y[i]);c.moveTo(field.x[i],field.y[i]-r*3);c.lineTo(field.x[i],field.y[i]+r*3);c.stroke();}
 }
 const x=w*.76,y=h*.3,r=Math.min(w*.15,h*.17)*(1+s.bass*.055);
 const halo=c.createRadialGradient(x,y,r*.9,x,y,r*1.65);halo.addColorStop(0,ink(-20,.16+s.level*.03,65));halo.addColorStop(.3,ink(15,.075,56));halo.addColorStop(1,ink(0,0));c.fillStyle=halo;c.fillRect(x-r*1.65,y-r*1.65,r*3.3,r*3.3);
 // Rear halves are occluded by the opaque shaded sphere; front halves cross it.
 const orbit=(i,front)=>{const a=spaceOrbitAngles[i]+t*spaceOrbitRates[i];c.beginPath();c.ellipse(x,y,r*(1.55+i*.2),r*(.37+i*.09),a,front?0:Math.PI,front?Math.PI:Math.PI*2);c.lineWidth=front?1.1:.65;c.strokeStyle=ink(i*14-15,front?.32:.12,79+i*5);c.stroke();};
 for(let i=0;i<3;i++)orbit(i,false);
 const sphere=c.createRadialGradient(x-r*.16,y-r*.18,0,x+r*.12,y+r*.1,r*1.35);sphere.addColorStop(0,ink(-18,1,39));sphere.addColorStop(.45,ink(-4,1,31));sphere.addColorStop(.82,ink(10,1,21));sphere.addColorStop(1,ink(18,1,14));c.fillStyle=sphere;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
 c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();
 for(let i=0;i<8;i++){
   c.beginPath();for(let j=0;j<=32;j++){const u=j/32,px=x-r+u*r*2,py=y-r*.8+i*r*.22+Math.sin(u*8+i+t*.025)*r*.035;j?c.lineTo(px,py):c.moveTo(px,py);}c.strokeStyle=ink(-20,.028,65);c.lineWidth=r*.035;c.stroke();
 }
 c.restore();c.beginPath();c.arc(x,y,r,Math.PI*.95,Math.PI*1.82);c.strokeStyle=ink(-20,.12,72);c.lineWidth=.9;c.stroke();
 for(let i=0;i<3;i++)orbit(i,true);
}

const retroFields=new WeakMap(),retroResponses=new WeakMap();
export function retroHorizon(w,h){return {x:w*.5,y:h*.56};}
export function createRetroResponse(){return {bass:0,mid:0,high:0,level:0,travel:0,wave:0,lastT:null};}
// Only the environmental drawing consumes this envelope. The analyser, meters,
// style renderers and soundtrack continue using their original audio data.
const retroBands=['bass','mid','high','level'];
// Frequency-band averages occupy different ranges. Calibrate environmental
// envelopes to those ranges rather than treating band averages as peak levels.
const retroResponseGains={bass:2.4,mid:5,high:35,level:6};
const retroAttack={bass:.035,mid:.060,high:.045,level:.080};
const retroRelease={bass:.14,mid:.20,high:.10,level:.22};
export function updateRetroResponse(state,signal,dt){
 for(const band of retroBands){
   const value=Math.max(0,Math.min(1,Number.isFinite(signal[band])?signal[band]:0));
   const target=1-Math.exp(-retroResponseGains[band]*value);
   const tau=target>state[band]?retroAttack[band]:retroRelease[band];
   state[band]+=(target-state[band])*(1-Math.exp(-Math.max(0,Math.min(1,dt))/tau));
 }
 return state;
}
const retroSeed=n=>{const v=Math.sin(n*77.39+31.8)*32457.17;return v-Math.floor(v);};
const retroGrain=Array.from({length:64},(_,i)=>({x:retroSeed(i),y:retroSeed(i+100),alpha:.025+retroSeed(i+200)*.025}));
export function createRetroGrid(){return new Float64Array(15*17*2);}
// One coherent projected surface shared by the horizontal and vertical lines.
// Every vertex is computed once, with distortion fading at the horizon.
export function updateRetroGrid(vertices,w,h,t,signal,point,travelPhase=t*.16,wavePhase=t*.5){
 const travel=((travelPhase%1)+1)%1,horizon=retroHorizon(w,h);
 for(let row=0;row<15;row++)for(let col=0;col<17;col++){
   const z=row===0?0:(row+travel)/14,depth=z*z;
   const x=horizon.x+(col-8)*w*.095*depth*1.9;
   const y=horizon.y+depth*(h-horizon.y)*1.045+Math.sin(col*.4+wavePhase+z*5)*h*.055*depth*signal.bass+Math.sin(z*6-wavePhase*.6)*h*.022*depth*signal.mid;
   const p=row===0?horizon:point(x,y,row*17+col),index=(row*17+col)*2,fade=Math.min(1,depth);vertices[index]=row===0?horizon.x:x+(p.x-x)*fade;vertices[index+1]=row===0?horizon.y:y+(p.y-y)*fade;
 }
 return vertices;
}
function drawRetro(f){
 const {ctx:c,w,h,t,ink,preset,point}=f;if(w<=0||h<=0)return;
 let s=retroResponses.get(c);if(!s){s=createRetroResponse();s.travel=t*.16;s.wave=t*.5;retroResponses.set(c,s);}
 updateRetroResponse(s,f.signal,f.dt??1/60);
 const elapsed=s.lastT===null?0:Math.max(0,t-s.lastT);s.lastT=t;
 s.travel+=elapsed*.16*(1+s.bass*.75+s.mid*.20);
 s.wave+=elapsed*.5*(1+s.bass*.9+s.mid*.3);
 const vp=retroHorizon(w,h);
 const color=(hue,alpha=1,light=65)=>ink(hue-preset.hue,alpha,light);
 const sky=c.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,color(270,.75,9));sky.addColorStop(.42,color(285,.3,23));sky.addColorStop(vp.y/h,color(320,.18+s.level*.16,30));sky.addColorStop(1,color(275,.82,5));c.fillStyle=sky;c.fillRect(0,0,w,h);
 const sunX=w*.5,sunY=h*.28,r=Math.min(h*.15,w*.14)*(1+s.bass*.10);
 const glow=c.createRadialGradient(sunX,sunY,0,sunX,sunY,r*3);
 glow.addColorStop(0,color(20,.19+s.level*.30+s.bass*.065,65));glow.addColorStop(.4,color(325,.12+s.level*.22+s.bass*.045,55));glow.addColorStop(1,color(300,0));c.fillStyle=glow;c.fillRect(sunX-r*3,sunY-r*3,r*6,r*6);
 const sun=c.createLinearGradient(0,sunY-r,0,sunY+r);sun.addColorStop(0,color(35,.9,73+s.level*4));sun.addColorStop(.5,color(12,.9,66+s.level*5));sun.addColorStop(1,color(325,.85,56+s.level*4));
 c.save();c.beginPath();c.arc(sunX,sunY,r,0,Math.PI*2);c.clip();c.fillStyle=sun;c.fillRect(sunX-r,sunY-r,r*2,r*2);
 c.fillStyle=color(280,.9,11);for(let band=0;band<7;band++)c.fillRect(sunX-r,sunY+band*r*.14,r*2,r*(.025+band*.008));c.restore();
 for(let layer=0;layer<2;layer++){
   c.beginPath();c.moveTo(0,vp.y);for(let i=0;i<=24;i++){
     const u=i/24,edge=Math.abs(u-.5)*2,height=.035+edge*.12+retroSeed(i+layer*40)*.08;
     c.lineTo(u*w,vp.y-h*height*(.65+layer*.3)+Math.sin(t*.15+i)*s.mid*h*.018);
   }c.lineTo(w,vp.y);c.lineTo(0,vp.y);c.closePath();c.fillStyle=color(270+layer*10,.9,layer?10:16);c.fill();c.strokeStyle=color(layer?190:325,.14+s.high*.20+s.mid*.05,60+s.high*5);c.lineWidth=1;c.stroke();
 }
 const horizon=c.createLinearGradient(0,vp.y-h*.03,0,vp.y+h*.05);horizon.addColorStop(0,color(320,0));horizon.addColorStop(.375,color(325,.15+s.level*.28+s.bass*.04,65));horizon.addColorStop(1,color(290,0));c.fillStyle=horizon;c.fillRect(0,vp.y-h*.03,w,h*.08);
 let vertices=retroFields.get(c);if(!vertices){vertices=createRetroGrid();retroFields.set(c,vertices);}updateRetroGrid(vertices,w,h,t,s,point,s.travel,s.wave);
 c.lineWidth=.8+s.high*.5;
 for(let row=0;row<15;row++){
   c.beginPath();for(let col=0;col<17;col++){const i=(row*17+col)*2;col?c.lineTo(vertices[i],vertices[i+1]):c.moveTo(vertices[i],vertices[i+1]);}
   c.strokeStyle=color(320,.08+row/14*.22+s.high*.12+s.level*.08,65+s.high*4);c.stroke();
 }
 for(let col=0;col<17;col++){
   c.beginPath();for(let row=0;row<15;row++){const i=(row*17+col)*2;row?c.lineTo(vertices[i],vertices[i+1]):c.moveTo(vertices[i],vertices[i+1]);}
   c.strokeStyle=color(col%4===0?190:310,(col%4===0?.22:.14)+s.level*.10+s.high*.12,63+s.high*4);c.stroke();
 }
}
function drawRetroOverlay(f){
 const {ctx:c,w,h,t,ink,preset,reduced,pointer}=f;if(w<=0||h<=0)return;
 const s=retroResponses.get(c)||f.signal;
 const color=(hue,alpha,light=70)=>ink(hue-preset.hue,alpha,light);
 // Overlay scanlines affect both scenery and style, without copying the canvas.
 c.fillStyle='rgba(5,0,15,0.085)';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);
 const tick=reduced?0:Math.floor(t*3);
 for(let i=0;i<64;i++){const grain=retroGrain[i],x=((grain.x*w+tick*13)%w+w)%w,y=((grain.y*h+tick*7)%h+h)%h;c.fillStyle=color(300,grain.alpha*(1+s.high*1.1),80);c.fillRect(x,y,1+(i%2),1);}
 // A low-contrast tracking seam passes occasionally (one window per 18 units).
 const cycle=t%18,window=reduced?0:Math.max(0,1-Math.abs(cycle-14)/.7),strength=window*(.015+s.high*.075);
 if(strength>0){const y=h*((cycle-13.3)/1.4);c.fillStyle=color(190,strength);c.fillRect(0,y,w,2);c.fillStyle=color(330,strength*.6);c.fillRect(3,y+3,w,1);}
 // Fast pointer movement adds a local brief signal tear, never a full-screen flash.
 if(pointer&&pointer.strength>.3&&!reduced){
   const alpha=Math.min(.12,(pointer.strength-.3)*.15),x=pointer.x*w,y=pointer.y*h;
   for(let band=0;band<3;band++){c.fillStyle=color(band%2?190:330,alpha/(band+1));c.fillRect(x-w*.12+Math.sin(t*3+band)*8,y+band*4,w*.24,1);}
 }
 c.strokeStyle=color(300,.12);c.lineWidth=2;c.strokeRect(3,3,w-6,h-6);
}

const dreamScenes=new WeakMap();
// Eight deliberately placed stars frame a quiet central region.
const dreamObjects=[[.12,.23,.4],[.31,.15,.65],[.79,.18,.35],[.9,.43,.75],[.16,.7,.55],[.36,.83,.35],[.75,.78,.9],[.88,.88,.45]].map(([x,y,depth],i)=>({x,y,depth,phase:i*1.73}));
const dreamBands=['bass','mid','high','level'];
const dreamGains={bass:2.1,mid:4,high:25,level:5};
export function createDreamResponse(){return {bass:0,mid:0,high:0,level:0};}
export function updateDreamResponse(state,signal,dt){
 for(const band of dreamBands){const raw=Number.isFinite(signal[band])?Math.max(0,Math.min(1,signal[band])):0,target=1-Math.exp(-dreamGains[band]*raw),tau=target>state[band]?(band==='level'?.16:.08):.35;state[band]+=(target-state[band])*(1-Math.exp(-Math.max(0,Math.min(1,dt))/tau));}
 return state;
}
export function createDreamField(){return new Float64Array(dreamObjects.length*6);}
// Poses are analytic and return to their base paths without particle accumulation.
export function updateDreamField(poses,w,h,t,response,reduced=false){
 const scale=Math.min(w,h),motion=reduced?.35:1;
 for(let i=0;i<dreamObjects.length;i++){
   const o=dreamObjects[i],phase=t*(.11+o.depth*.05)+o.phase,j=i*6;
   const fade=i%4===0?Math.max(0,(Math.sin(t*.09+o.phase)+.35)/1.35)**2:.7+.3*Math.sin(t*.07+o.phase)**2;
   poses[j]=o.x*w+Math.sin(phase)*scale*.025*o.depth*(1+response.mid*.8)*motion;
   poses[j+1]=o.y*h+Math.cos(phase*.73)*scale*.025*o.depth*motion+Math.sin(phase*1.3)*scale*.014*response.mid*motion;
   poses[j+2]=scale*(.02+o.depth*.045)*(1+response.bass*(reduced?.08:.18+(i%3)*.08));
   poses[j+3]=Math.sin(phase*.5)*(.12+o.depth*.3)*motion;
   poses[j+4]=fade*(.25+o.depth*.4);
   poses[j+5]=response.mid*.12*motion+Math.sin(phase)*.025;
 }
 return poses;
}
// Ten alternating vertices produce five distinct points, with no quadrilateral decor.
export function drawDreamStar(c,r){
 c.beginPath();for(let k=0;k<10;k++){const a=k/10*Math.PI*2-Math.PI/2,rr=r*(k%2?.43:1);k?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();
}
const dreamStarHues=[333,273,187,265,325,273,333,187];
// Exact reference swatches, with fixed hues rather than rainbow cycling.
const dreamPalette=[[168,233,236],[145,207,232],[200,181,234],[233,184,220],[245,197,173],[244,241,237],[245,231,172],[217,242,242]];
const dreamColor=(index,alpha=1)=>{const p=dreamPalette[index];return `rgba(${p[0]},${p[1]},${p[2]},${Math.max(0,Math.min(1,alpha))})`;};
const dreamFields=[{x:.06,y:.25,rx:.55,ry:.8,color:0},{x:.7,y:.05,rx:.52,ry:.66,color:2},{x:.92,y:.61,rx:.52,ry:.68,color:4},{x:.42,y:.9,rx:.6,ry:.55,color:1},{x:.33,y:.42,rx:.27,ry:.45,color:5},{x:.7,y:.78,rx:.3,ry:.3,color:3}];
const dreamMist=[{x:.12,y:.19,rx:.2,ry:.065,color:0,depth:.25},{x:.82,y:.23,rx:.17,ry:.055,color:4,depth:.3},{x:.13,y:.67,rx:.24,ry:.085,color:4,depth:.65},{x:.84,y:.83,rx:.3,ry:.13,color:0,depth:1}];
const dreamPuffs=[{x:-.43,y:.12,r:.76},{x:0,y:-.12,r:1},{x:.47,y:.13,r:.68}];
function drawDreamGradient(f,s){
 const {ctx:c,w,h,reduced}=f,t=reduced?0:f.t;
 c.fillStyle=dreamColor(1);c.fillRect(0,0,w,h);
 for(let i=0;i<dreamFields.length;i++){
  const b=dreamFields[i],phase=t*(.034+i*.004)+i*1.7,x=w*(b.x+Math.sin(phase)*.055),y=h*(b.y+Math.cos(phase*.73)*.055);
  const morph=1+Math.sin(phase*.61)*.08,rx=w*b.rx*morph,ry=h*b.ry/morph;
  c.save();c.translate(x,y);c.rotate(Math.sin(phase*.5)*.18);c.scale(rx,ry);
  const g=c.createRadialGradient(-.12,Math.sin(phase)*.1,0,0,0,1);
  g.addColorStop(0,dreamColor(b.color,.92));g.addColorStop(.45,dreamColor(b.color,.7));g.addColorStop(1,dreamColor(b.color,0));c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
 }
 // Broad pearlescent light breathes with the existing smoothed RMS envelope.
 const glow=c.createRadialGradient(w*.48,h*.38,0,w*.48,h*.38,Math.max(w,h)*.65);glow.addColorStop(0,dreamColor(5,.035+s.level*.085));glow.addColorStop(1,dreamColor(5,0));c.fillStyle=glow;c.fillRect(0,0,w,h);
}
function drawDreamMist(f,s,index){
 const {ctx:c,w,h,reduced,point}=f,b=dreamMist[index],t=reduced?0:f.t;
 const phase=t*(.018+b.depth*.035)+index*2.1,motion=reduced?.2:1;
 const p=point(w*(b.x+Math.sin(phase)*.018*b.depth),h*(b.y+Math.cos(phase*.7)*.012*b.depth),index);
 const breath=1+s.bass*.055*b.depth*motion,rx=w*b.rx*breath,ry=h*b.ry*breath;
 const x=p.x,y=p.y,opacity=.27+b.depth*.3+s.level*.1;
 c.save();c.translate(x,y);c.scale(rx,ry);
 const shadow=c.createRadialGradient(0,.6,0,0,.6,1);shadow.addColorStop(0,dreamColor(2,opacity*.5));shadow.addColorStop(1,dreamColor(2,0));c.fillStyle=shadow;c.fillRect(-1,-.4,2,2);
 for(let i=0;i<3;i++){
  const puff=dreamPuffs[i],deform=Math.sin(phase*.8+i)*(.035+s.mid*.035)*motion,px=puff.x,py=puff.y+deform;
  c.save();c.translate(px,py);c.scale(puff.r*.8,puff.r*(1+deform)*(1+b.depth*.5));
  const g=c.createRadialGradient(-.12,-.22,0,0,0,1);
  g.addColorStop(0,dreamColor(5,opacity+s.bass*.1+s.high*.08));g.addColorStop(.4,dreamColor(5,opacity*.8));g.addColorStop(.7,dreamColor(7,opacity*.45));g.addColorStop(1,dreamColor(b.color,0));c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
 }
 c.restore();
}
function drawDreamcore(f){
 const {ctx:c,w,h,t,ink,preset,point,reduced}=f;if(w<=0||h<=0)return;
 let scene=dreamScenes.get(c);if(!scene){scene={response:createDreamResponse(),poses:createDreamField(),grain:createDreamGrainPattern(c)};dreamScenes.set(c,scene);}
 const s=updateDreamResponse(scene.response,f.signal,f.dt??1/60),poses=updateDreamField(scene.poses,w,h,t,s,reduced);
 drawDreamGradient(f,s);
 for(let layer=0;layer<3;layer++)drawDreamMist(f,s,layer);
 for(let i=0;i<dreamObjects.length;i++){
   const j=i*6,p=point(poses[j],poses[j+1],i),r=poses[j+2]*.65,alpha=poses[j+4],hue=dreamStarHues[i]-preset.hue;
   const glow=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.1);glow.addColorStop(0,ink(hue,alpha*(.14+s.high*.1),85));glow.addColorStop(1,ink(hue,0,80));c.fillStyle=glow;c.fillRect(p.x-r*2.1,p.y-r*2.1,r*4.2,r*4.2);
   c.save();c.translate(p.x,p.y);c.rotate(poses[j+3]);drawDreamStar(c,r);
   const surface=c.createLinearGradient(-r,-r,r,r);surface.addColorStop(0,ink(hue,alpha*.8,90));surface.addColorStop(.55,ink(hue,alpha*.4,76));surface.addColorStop(1,ink(273-preset.hue,alpha*.55,85));c.fillStyle=surface;c.fill();
   c.strokeStyle=ink(hue,alpha*(.6+s.high*.35),65);c.lineWidth=.8;c.stroke();c.restore();
 }
}
// One reusable, deterministic 128px noise tile; never sample pixels per frame.
export function createDreamGrainData(){
 const data=new Uint8ClampedArray(128*128*4);let seed=2166136261;
 for(let i=0;i<data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed>>>31?255:0;data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=16+(seed>>>16)%25;}
 return data;
}
let dreamNoiseTile=null;
function createDreamGrainPattern(c){
 if(!dreamNoiseTile){
  const tile=typeof OffscreenCanvas==='function'?new OffscreenCanvas(128,128):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(!tile)return null;tile.width=128;tile.height=128;const g=tile.getContext('2d');if(!g)return null;
  const image=g.createImageData(128,128);image.data.set(createDreamGrainData());g.putImageData(image,0,0);dreamNoiseTile=tile;
 }
 return c.createPattern(dreamNoiseTile,'repeat');
}
function drawDreamForeground(f){
 const {ctx:c,w,h,t,reduced}=f;if(w<=0||h<=0)return;
 const s=dreamScenes.get(c)?.response||f.signal;drawDreamMist(f,s,3);
 const grain=dreamScenes.get(c)?.grain;if(grain){
  const tick=reduced?0:Math.floor(t*5),x=tick*37%128,y=tick*53%128;
  c.save();c.translate(x,y);c.globalAlpha=.32;c.fillStyle=grain;c.fillRect(-x,-y,w,h);c.restore();
 }
}
