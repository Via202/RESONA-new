import { drawTapeTexture, drawTapeEcho } from './retro-tape.js';
// Every language consumes the same mapped controls, analyser and pointer field.
export const languages={liquid,geometric,glitch,dreamlike};
function liquid(f){
  const {ctx:c,w,h,t,controls:v,signal:s,ink,point,preset}=f;
  const count=5+Math.round(v.chaos*5),samples=70;
  for(let band=count-1;band>=0;band--){
    const center=h*(.28+band/(count-1)*.4),thickness=h*(.025+s.bass*.07)*(1+band*.06);
    c.beginPath();
    for(let edge=0;edge<2;edge++)for(let j=0;j<=samples;j++){
      const u=edge?1-j/samples:j/samples,x=u*w*1.1-w*.05;
      const wave=Math.sin(u*6+t+band*.5)*(h*.045+s.mid*h*.06)+Math.sin(u*(10+v.chaos*9)-t*.7+band)*h*.045*v.distortion*preset.deformation;
      const p=point(x,center+wave+(edge?1:-1)*thickness,band);j===0&&edge===0?c.moveTo(p.x,p.y):c.lineTo(p.x,p.y);
    }
    c.closePath();const g=c.createLinearGradient(0,center-thickness,0,center+thickness);g.addColorStop(0,ink(band*9,.08+s.level*.3,82));g.addColorStop(.5,ink(band*9,.3+s.level*.4,55));g.addColorStop(1,ink(band*9,.06,35));c.fillStyle=g;c.fill();c.strokeStyle=ink(band*9,.2+s.high*.4,85);c.lineWidth=1;c.stroke();
  }
}
function geometric(f){
  const {ctx:c,w,h,t,controls:v,signal:s,ink,point}=f;
  const satellites=4+Math.round(v.chaos*7),scale=Math.min(w,h);
  const cx=w*.5,cy=h*.49;
  const hub=point(cx,cy,0);

  function polygon(p,r,sides,rotation,depth,primary){
    c.save();
    c.translate(p.x,p.y);
    c.rotate(rotation);
    c.scale(1+Math.sin(rotation)*v.distortion*.22,1+Math.cos(rotation)*v.distortion*.17);
    for(let face=0;face<sides;face++){
      const a1=face/sides*Math.PI*2,a2=(face+1)/sides*Math.PI*2;
      c.beginPath();
      c.moveTo(0,0);
      c.lineTo(Math.cos(a1)*r,Math.sin(a1)*r);
      c.lineTo(Math.cos(a2)*r,Math.sin(a2)*r);
      c.closePath();
      const light=(primary?40:29)+face/sides*34;
      c.fillStyle=ink(face*7,(primary?.57:.25+depth*.24)+s.level*.24,light);
      c.fill();
      c.strokeStyle=ink(20,(primary?.52:.18+depth*.24)+s.high*.32,primary?89:77);
      c.lineWidth=primary?1.35:.8;
      c.stroke();
    }
    c.restore();
  }

  for(let i=0;i<satellites;i++){
    const angle=i*Math.PI*2/satellites+t*.16;
    const depth=(1+Math.sin(angle))*.5;
    const orbit=scale*(.32+(i%2)*.045+Math.sin(t*.9+i)*(.014+s.mid*.02));
    const p=point(cx+Math.cos(angle)*orbit*1.18,cy+Math.sin(angle)*orbit*.82,i+1);
    const radius=scale*(.037+depth*.033)*(1+s.bass*.38);
    c.beginPath();
    c.moveTo(hub.x,hub.y);
    c.lineTo(p.x,p.y);
    c.strokeStyle=ink(0,.07+s.mid*.18+depth*.06,76);
    c.lineWidth=.75;
    c.stroke();
    polygon(p,radius,i%3===0?6:3,angle*.5+t*(i%2?-.22:.22),depth,false);
  }
  polygon(hub,scale*.17*(1+s.bass*.42),6,t*.22,1,true);
}
function glitch(f){
  const {ctx:c,w,h,t,controls:v,signal:s,point,reduced,preset,baseHue:primaryHue}=f;
  const left=w*.09,top=h*.14,width=w*.82,height=h*.69;
  const center=top+height/2;
  const secondaryHue=primaryHue+42;
  const amplitude=height*(.09+s.bass*.24);
  const samples=112,layers=5;
  const tape=preset.id==='retro';
  c.save();
  c.strokeStyle=`hsla(${secondaryHue},82%,75%,.68)`;
  c.lineWidth=1.35;
  if(tape)drawTapeTexture(c,left,top,width,height,reduced,f.tapePhase);
  c.strokeRect(left,top,width,height);
  for(let layer=layers-1;layer>=0;layer--){
    const main=layer===0;
    const echo=tape&&main&&!reduced&&s.level>.025?[]:null;
    const hue=layer%2===0?primaryHue:secondaryHue;
    const opacity=main?.72+s.level*.22:.21+s.mid*.36+s.level*.17;
    const phase=layer*.57;
    c.beginPath();
    for(let i=0;i<=samples;i++){
      const u=i/samples;
      const envelope=Math.sin(u*Math.PI)**.7;
      const angle=u*Math.PI*(5+v.chaos*3)-t*2+phase;
      const harmonic=Math.sin(angle*2.1+t+phase)*v.distortion*.28;
      const shimmer=reduced?0:Math.sin(u*91+t*4+phase)*s.high*.035;
      const y=center+envelope*amplitude*(Math.sin(angle)+harmonic+shimmer)*(1-layer*.085);
      const p=point(left+u*width,y,i+layer);
      const x=left+u*width+(p.x-left-u*width)*envelope;
      const px=Math.max(left+1,Math.min(left+width-1,x));
      const py=Math.max(top+1,Math.min(top+height-1,y+(p.y-y)*envelope));
      if(echo)echo.push(px,py);
      if(i===0)c.moveTo(px,py);
      else c.lineTo(px,py);
    }
    c.strokeStyle=`hsla(${hue},94%,${main?75:66}%,${opacity})`;
    c.lineWidth=main?2.15+s.high*.65:layer%2===0?1.55:1.1;
    if(main&&!reduced){
      c.shadowColor=`hsla(${primaryHue},94%,75%,${.15+s.level*.22})`;
      c.shadowBlur=4*preset.glow;
    }
    c.stroke();
    if(echo)drawTapeEcho(c,echo,left,top,width,height,secondaryHue,t,s.level);
  }
  c.restore();
}
function dreamlike(f){
  const {ctx:c,w,h,t,controls:v,signal:s,ink,point}=f;
  const count=7+Math.round(v.chaos*11);
  for(let i=count-1;i>=0;i--){
    const depth=.35+(i%4)*.22;
    const x=w*(.13+(i*.618%1)*.74)+Math.sin(t*.5+i)*w*.035*(1+v.chaos),y=h*(.22+(i*.382%1)*.52)+Math.cos(t*.4+i)*h*.06;
    const p=point(x,y,i),r=Math.min(w,h)*(.035+(i%3)*.02)*depth*(1+s.bass*.4);
    const glow=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.4);glow.addColorStop(0,ink(i*7,.22+s.level*.4,83));glow.addColorStop(1,ink(i*7,0));c.fillStyle=glow;c.fillRect(p.x-r*2.4,p.y-r*2.4,r*4.8,r*4.8);
    c.save();c.translate(p.x,p.y);c.rotate(Math.sin(t+i)*v.distortion);c.beginPath();c.ellipse(0,0,r*(1+v.distortion*.65),r*(1-v.distortion*.3),0,0,Math.PI*2);c.fillStyle=ink(i*7,.17+s.mid*.3,78);c.fill();c.strokeStyle=ink(i*7,.35+s.high*.5,93);c.lineWidth=1.5;c.stroke();
    c.beginPath();c.ellipse(-r*.18,-r*.2,r*.45,r*.2,-.3,0,Math.PI);c.strokeStyle=ink(20,.55,98);c.stroke();c.restore();
  }
}
