import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicEngine,chordAt,melodyNote} from '../js/music-engine.js';
import {musicPresets} from '../js/music-presets.js';
import {environments} from '../js/environments.js';

test('each environment has its own valid, looping progression and scale-constrained motif',()=>{
  assert.deepEqual(Object.keys(musicPresets).sort(),Object.keys(environments).sort());
  assert.deepEqual(Object.values(musicPresets).map(p=>p.bpm),[76,92,84,88,110]);
  for(const p of Object.values(musicPresets)){
    assert.equal(new Set(p.scale).size,7);
    const period=p.chords.length*p.bars;
    for(let bar=0;bar<period;bar++){
      const chord=chordAt(p,bar);
      assert.equal(chord.root,p.tonic+p.chords[Math.floor(bar/p.bars)][0]);
      assert.ok(chord.notes.length>=4 && chord.notes.every(n=>n>=48&&n<=75));
      assert.deepEqual(chord,chordAt(p,bar+period));
      for(const [step,degree] of p.notes){
        assert.ok(step>=0&&step<16&&degree<p.scale.length);
        assert.ok(p.scale.includes((melodyNote(p,degree,bar)-p.tonic)%12));
        assert.equal(melodyNote(p,degree,bar),melodyNote(p,degree,bar+period));
      }
    }
  }
});

function rig(){
  const events=[], intervals=new Map();
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
  const node=()=>({connect(dest){this.dest=dest;},disconnect(){this.dest=null;}});
  const source=kind=>({...node(),frequency:param(),start(time){events.push({kind,time,source:this});},stop(time){this.end=time;}});
  const context={currentTime:0,sampleRate:48000,createBuffer(ch,n){return {getChannelData(){return new Float32Array(n);}};},
    createGain:()=>({...node(),gain:param()}),createOscillator:()=>source('oscillator'),
    createBufferSource:()=>source('noise'),createBiquadFilter:()=>({...node(),frequency:param()})};
  let serial=0;
  const timers={setInterval(fn){intervals.set(++serial,fn);return serial;},clearInterval(id){intervals.delete(id);}};
  const output=node(), engine=new MusicEngine(context,output,timers);
  const advance=to=>{while(context.currentTime<to){context.currentTime+=.025;for(const fn of intervals.values())fn();}};
  return {engine,output,context,events,intervals,advance};
}

test('audio-clock scheduler emits four routed layers and stops scheduled voices without a second timer',()=>{
  const {engine,output,events,intervals,context,advance}=rig();
  engine.setPreset(musicPresets.retro);
  engine.start();engine.start();
  assert.equal(intervals.size,1);
  const run=engine.run;
  assert.equal(run.master.dest,output);
  advance(1);
  const layer=event=>Object.keys(run.buses).find(name=>{
    for(let n=event.source;n;n=n.dest)if(n===run.buses[name])return true;
    return false;
  });
  assert.deepEqual(new Set(events.map(layer)),new Set(['chords','bass','percussion','melody']));
  assert.ok(events.some(e=>layer(e)==='bass'&&e.source.frequency.value<100));
  assert.ok(events.some(e=>layer(e)==='percussion'&&e.kind==='oscillator'));
  assert.ok(events.some(e=>layer(e)==='percussion'&&e.kind==='noise'));
  engine.setLayer('melody',false);
  const before=events.length;
  advance(2);
  assert.ok(events.length>before);
  assert.ok(events.slice(before).every(e=>layer(e)!=='melody'));
  const oldTick=[...intervals.values()][0];
  engine.stop();engine.stop();
  assert.equal(intervals.size,0);
  assert.ok(events.every(e=>e.source.end<=context.currentTime+.045));
  const total=events.length;
  advance(5);oldTick();
  assert.equal(events.length,total);
  for(const event of events)event.source.onended();
  assert.equal(run.master.dest,null);
  engine.start();
  assert.equal(intervals.size,1);
});

test('the latest environment preset takes effect on the next downbeat without restarting transport',()=>{
  const {engine,intervals,advance}=rig();
  engine.setPreset(musicPresets.underwater);engine.start();
  const run=engine.run;
  advance(.4);
  engine.setPreset(musicPresets.space);
  engine.setPreset(musicPresets.cyberpunk);
  advance(2);
  assert.equal(run.preset,musicPresets.underwater);
  advance(3.2);
  assert.equal(run.preset,musicPresets.cyberpunk);
  assert.equal(run.bar,0);
  assert.equal(engine.run,run);
  assert.equal(intervals.size,1);
});
