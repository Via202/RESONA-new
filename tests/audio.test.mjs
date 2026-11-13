import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioEngine,bandEnergy} from '../js/audio.js';
test('FFT bins isolate bass, mid and high at multiple sample rates',()=>{
  for(const rate of [44100,48000])for(const [frequency,target] of [[100,0],[1000,1],[5000,2]]){
    const data=new Uint8Array(1024);data[Math.round(frequency*2048/rate)]=255;
    const bands=[[30,250],[250,2000],[2000,12000]].map(([lo,hi])=>bandEnergy(data,rate,2048,lo,hi));
    assert.ok(bands[target]>0);assert.equal(bands.filter(n=>n>0).length,1);
  }
});
test('generated input shares the media analyser, samples while paused and disconnects cleanly',async()=>{
  let mediaSources=0, analysers=0, connects=0, disconnects=0, plays=0;
  const analyser={frequencyBinCount:1024,connect(){},getByteFrequencyData(data){data.fill(60);},getFloatTimeDomainData(data){data.fill(.125);}};
  globalThis.window={AudioContext:class {
    sampleRate=48000;state='suspended';destination={};
    createMediaElementSource(){mediaSources++;return {connect(target){assert.equal(target,analyser);}};}
    createAnalyser(){analysers++;return analyser;}
    async resume(){this.state='running';}
  }};
  const media={paused:true,async play(){plays++;this.paused=false;}};
  const audio=new AudioEngine(media);
  const external={connect(target){assert.equal(target,analyser);connects++;},disconnect(target){assert.equal(target,analyser);disconnects++;}};
  await audio.resume();
  audio.connectExternal(external);audio.connectExternal(external);
  assert.equal(connects,1);assert.equal(plays,0);assert.equal(media.paused,true);
  const signal=audio.sample();
  assert.equal(signal.level,.125);
  for(const band of ['bass','mid','high'])assert.ok(signal[band]>0);
  audio.disconnectExternal(external);audio.disconnectExternal(external);
  assert.equal(disconnects,1);assert.equal(audio.sample().level,0);
  await audio.start(()=>false);
  assert.equal(plays,0);
  await audio.start();
  assert.equal(plays,1);assert.equal(audio.sample().level,.125);
  assert.equal(mediaSources,1);assert.equal(analysers,1);
});
test('media graph is reused, RMS uses waveform, paused input returns zero',async()=>{
  let sources=0;
  const analyser={frequencyBinCount:1024,connect(){},getByteFrequencyData(data){data.fill(0);data[4]=255;},getFloatTimeDomainData(data){data.fill(.25);}};
  globalThis.window={AudioContext:class {sampleRate=48000;state='running';destination={};createMediaElementSource(){sources++;return {connect(){}};}createAnalyser(){return analyser;}async resume(){}}};
  const media={paused:true,async play(){this.paused=false;}};
  const engine=new AudioEngine(media);assert.equal(engine.sample().level,0);
  await engine.start();await engine.start();assert.equal(sources,1);
  assert.equal(engine.sample().level,.25);assert.ok(engine.sample().bass>0);assert.equal(engine.sample().high,0);
  media.paused=true;assert.deepEqual(engine.sample(),{bass:0,mid:0,high:0,level:0});
});
