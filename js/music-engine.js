const hz=note=>440*2**((note-69)/12);
const layers=['chords','bass','percussion','melody'];
export function chordAt(preset,bar){
  const index=Math.floor(bar/preset.bars)%preset.chords.length;
  const [offset,intervals]=preset.chords[index];
  const root=preset.tonic+offset;
  // Keep pads in a compact register; alternate open and close voicings.
  const notes=intervals.map((interval,i)=>{
    let note=root+interval;
    while(note>75)note-=12;
    if(index%2 && i===0 && note>60)note-=12;
    return note;
  });
  return {root,notes};
}
export function melodyNote(preset,degree,bar){
  const index=(degree+bar%preset.chords.length)%preset.scale.length;
  return preset.tonic+preset.scale[index]+12;
}
export class MusicEngine{
  constructor(context,output,timers=globalThis){
    this.context=context;
    this.output=output;
    this.timers=timers;
    this.volume=.7;
    this.enabled=Object.fromEntries(layers.map(name=>[name,true]));
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.25),context.sampleRate);
    const noise=buffer.getChannelData(0);
    let seed=1234;
    for(let i=0;i<noise.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      noise[i]=seed/2147483648-1;
    }
    this.noise=buffer;
  }
  setPreset(preset){this.pending=preset;}
  setVolume(value){
    this.volume=value;
    this.run?.master.gain.setTargetAtTime(value,this.context.currentTime,.025);
  }
  setLayer(name,enabled){
    if(!layers.includes(name))return;
    this.enabled[name]=Boolean(enabled);
    this.run?.buses[name].gain.setTargetAtTime(Number(this.enabled[name]),this.context.currentTime,.025);
  }
  get playing(){return Boolean(this.run);}
  start(){
    if(this.run || !this.pending)return;
    const {context}=this;
    const master=context.createGain();
    master.gain.value=this.volume;
    master.connect(this.output);
    const buses=Object.fromEntries(layers.map(name=>{
      const bus=context.createGain();
      bus.gain.value=Number(this.enabled[name]);
      bus.connect(master);
      return [name,bus];
    }));
    const run={master,buses,voices:new Set(),step:0,bar:0,preset:this.pending,next:context.currentTime+.035};
    this.run=run;
    this.tick(run);
    run.timer=this.timers.setInterval(()=>this.tick(run),25);
  }
  stop(){
    const run=this.run;
    if(!run)return;
    this.run=null;
    this.timers.clearInterval(run.timer);
    const now=this.context.currentTime;
    run.master.gain.cancelScheduledValues(now);
    run.master.gain.setTargetAtTime(0,now,.008);
    for(const voice of run.voices)voice.stop(Math.min(voice.end,now+.045));
    if(!run.voices.size)run.master.disconnect();
  }
  tick(run){
    if(this.run!==run)return;
    const now=this.context.currentTime;
    // After browser timer throttling, restart on a downbeat instead of bunching missed notes.
    if(run.next<now){
      if(run.step!==0)run.bar++;
      run.step=0;
      run.next=now+.025;
    }
    while(run.next<now+.12){
      if(run.step===0 && run.preset!==this.pending){
        run.preset=this.pending;
        run.bar=0;
      }
      const beat=60/run.preset.bpm, subdivision=beat/4;
      this.schedule(run,run.next+(run.step%2)*subdivision*run.preset.swing,beat);
      run.next+=subdivision;
      if(++run.step===16){run.step=0;run.bar++;}
    }
  }
  voice(run,layer,source,time,attack,hold,release,peak,filter){
    const gain=this.context.createGain();
    gain.gain.setValueAtTime(0,time);
    gain.gain.linearRampToValueAtTime(peak,time+attack);
    gain.gain.setValueAtTime(peak,time+attack+hold);
    const end=time+attack+hold+release;
    gain.gain.linearRampToValueAtTime(0,end);
    if(filter){source.connect(filter);filter.connect(gain);}else source.connect(gain);
    gain.connect(run.buses[layer]);
    const voice={end,stop:when=>source.stop(when)};
    run.voices.add(voice);
    source.onended=()=>{
      source.disconnect();filter?.disconnect();gain.disconnect();
      run.voices.delete(voice);
      if(this.run!==run && !run.voices.size)run.master.disconnect();
    };
    source.start(time);
    source.stop(end);
  }
  tone(run,layer,type,note,time,attack,hold,release,peak){
    const osc=this.context.createOscillator();
    osc.type=type;
    osc.frequency.value=hz(note);
    this.voice(run,layer,osc,time,attack,hold,release,peak);
  }
  noiseHit(run,time,hat,amount){
    const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter();
    source.buffer=this.noise;
    filter.type=hat?'highpass':'bandpass';
    filter.frequency.value=hat?6100:1850;
    this.voice(run,'percussion',source,time,.003,.005,hat?.055:.15,amount,filter);
  }
  schedule(run,time,beat){
    const {preset:p,bar,step}=run;
    if(step===0)run.chord=chordAt(p,bar);
    const {root,notes}=run.chord;
    // A one-bar pad refresh also lets every preset change land cleanly on a downbeat.
    if(step===0 && this.enabled.chords){
      for(const note of notes){
        this.tone(run,'chords',p.pad,note,time,p.attack,beat*4-p.attack-p.release,p.release,.19/notes.length);
      }
    }
    if(this.enabled.bass && (step===0 || step===8 || (p.bpm>=100 && step===12))){
      this.tone(run,'bass',p.bass,root-24,time,.018,beat*(p.bpm>=100?.48:1.05),.16,.16);
    }
    if(this.enabled.percussion){
      if(p.kicks.includes(step)){
        const kick=this.context.createOscillator();
        kick.frequency.setValueAtTime(118,time);
        kick.frequency.exponentialRampToValueAtTime(42,time+.12);
        this.voice(run,'percussion',kick,time,.005,.015,.18,.42*p.drums);
      }
      if(p.snares.includes(step))this.noiseHit(run,time,false,.58*p.drums);
      if(p.hats.includes(step))this.noiseHit(run,time,true,.39*p.drums);
    }
    if(this.enabled.melody){
      const note=p.notes.find(([at])=>at===step);
      if(note)this.tone(run,'melody',p.melody,melodyNote(p,note[1],bar),time,.025,beat*.28,.23,p.bpm>=100?.032:.065);
    }
  }
}
