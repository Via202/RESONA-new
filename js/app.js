import { attachPointer } from './pointer.js';
import { parameters, randomizeVisuals } from './parameters.js';
import { AudioEngine } from './audio.js';
import { createVisualizer } from './visualizer.js';
import { environments, styles } from './environments.js';
import { createCyberHud } from './cyber-hud.js';
import { CreatePlayback } from './create/scheduler.js';
import { CreateSelection } from './create/selection.js';
import { CreativeControls, generationSettings, liveNames } from './create/controls.js';
import { bindPlaybackShortcut } from './playback-shortcut.js';
import { remixProfiles } from './remix-profiles.js';
import { bindExportControls } from './export-controls.js';
const $=id=>document.getElementById(id);
const audio=$('audio'),engine=new AudioEngine(audio),draw=createVisualizer($('visualizer'));
const pointer=attachPointer($('visualizer'),()=>environment);
const cyberHud=createCyberHud($('cyber-hud'),$('visualizer'),document.querySelector('.stage'));
const status=message=>$('status').textContent=message;
const mediaError=()=>objectURL?'This audio file could not be played. Choose another file.':
  'Soundtrack unavailable. Load your own audio below.';
const format=n=>Number.isFinite(n)?`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`:'0:00';
audio.volume=Number($('volume').value);
let busy=false,objectURL,uploadedFile,revision=0;
let environment="underwater",style="liquid";
$('track-title').textContent=environments[environment].title;
let mode='remix',music,nextSeed=0,createVolume=audio.volume;
const selection=new CreateSelection();
const creative=new CreativeControls(environment);
const remixValues={...remixProfiles[environment].defaults};
let remixProcessed=false;
function updateRemix(){engine.setRemix(remixValues,remixProcessed,environment);}
function syncRemixControls(){
  for(const name of Object.keys(parameters))parameters[name]=remixValues[name];
  syncControls();
  for(const name of ['energy','space']){
    $(name).value=remixValues[name];
    $(name+'-value').value=String(remixValues[name]);
  }
  updateCreativeHints();
}
const visualHints={chaos:'Order → unpredictability',speed:'Slow → energetic',
  distortion:'Clean → deformed',color:'Hue shift / centre is original'};
const audioHints={chaos:['Next Generate','Musical variation'],speed:['Next Generate',''],
  distortion:['Live','Audio saturation'],color:['Live','Tonal brightness']};
function syncCreativeControls(){
  if(mode!=='create')return;
  for(const name of Object.keys(parameters))parameters[name]=creative.draft[name];
  syncControls();
  for(const name of ['energy','density','melody','space']){
    $(name).value=creative.draft[name];
    $(name+'-value').value=String(creative.draft[name]);
  }
  updateCreativeHints();
}
function updateCreativeHints(){
  for(const [name,hint] of Object.entries(visualHints)){
    const [timing,detail]=$(name+'-hint').children;
    if(mode==='create'){
      timing.textContent=audioHints[name][0];
      detail.textContent=name==='speed'?`${generationSettings(environment,creative.draft).tempo} BPM`:audioHints[name][1];
    }else{
      const hasAudio=name==='color'||name==='distortion';
      timing.textContent=hasAudio&&remixProcessed?'Visual + audio':'Visual';
      detail.textContent=hasAudio&&remixProcessed?audioHints[name][1]:hint;
    }
  }
  $('energy-hint').children[0].textContent=mode==='create'||remixProcessed?'Live':'Processed';
  $('energy-hint').children[1].textContent=mode==='create'?'Layer intensity':'Compression and punch';
  $('space-hint').children[0].textContent=mode==='create'||remixProcessed?'Live':'Processed';
}
function setCreative(name,value,apply=true){
  creative.set(name,value);
  if(apply&&creative.live&&liveNames.includes(name))music?.setControls(creative.live);
}
function transport(playing){
  $('play').textContent=playing?'Ⅱ':'▶';
  $('play').setAttribute('aria-label',playing?'Pause audio':
    mode==='create'&&music?.state==='paused'?'Resume audio':'Play audio');
}
function showCreatePosition(){
  const {bar,cycle,tick}=music?.position ?? {bar:1,cycle:0,tick:0};
  const label=`BAR ${bar}/32 · BEAT ${Math.floor(tick%384/96)+1}`;
  const loop=`LOOP ${cycle+1}`;
  if($('current').textContent!==label)$('current').textContent=label;
  if($('duration').textContent!==loop)$('duration').textContent=loop;
  $('seek').value=tick/12288*100;
}
function showGenerated(){
  const active=music?.state==='playing'||music?.state==='paused';
  const score=active?selection.current:selection.pending??selection.current;
  $('soundtrack-label').textContent='CREATE / PROCEDURAL MUSIC';
  $('track-title').textContent=score?
    `${environments[score.environmentId].name} · ${score.tempo} BPM · Seed ${score.seed}`:
    `${environments[environment].name} · No composition yet`;
  $('seek').disabled=true;
  $('stop-score').disabled=!active;
  $('restart-score').disabled=!score;
  transport(music?.state==='playing');
  showCreatePosition();
}
function queueHint(){
  return selection.pending?' · Replacement ready. Stop, then Play to switch.':'';
}
async function startCreate(restart=false){
  if(busy||mode!=='create')return;
  if(!selection.pending&&!selection.current){status('Generate a composition first.');return;}
  busy=true;
  const attempt=revision;
  try{
    const context=await engine.resume();
    if(attempt!==revision)return;
    audio.pause();
    if(!music){
      music=new CreatePlayback({
        context,
        connect:node=>engine.connectExternal(node),
        disconnect:node=>engine.disconnectExternal(node),
        onError:error=>{if(mode==='create'){showGenerated();status(`CREATE stopped: ${error.message}`);}}
      });
    }
    music.setVolume(createVolume);
    const score=selection.select({resume:music.state==='paused',restart});
    music.setControls(creative.activate(score));
    if(restart)music.restart(score);
    else music.play(score);
    showGenerated();
    status('Playing composition / analysing live audio'+queueHint());
  }catch(error){
    if(attempt===revision){showGenerated();status(`Cannot play CREATE: ${error.message}`);}
  }finally{
    if(attempt===revision)busy=false;
  }
}
$('generate-score').addEventListener('click',()=>{
  if(mode!=='create')return;
  try{
    const score=selection.generate({environmentId:environment,seed:nextSeed,
      ...generationSettings(environment,creative.draft)},creative.capture());
    nextSeed++;
    showGenerated();
    status(music?.state==='playing'||music?.state==='paused'?
      `${environments[score.environmentId].name} queued. Stop, then Play to switch.`:'Composition ready. Press Play.');
  }catch(error){status(`Could not generate: ${error.message}`);}
});
$('stop-score').addEventListener('click',()=>{
  revision++;busy=false;music?.stop();showGenerated();status('Stopped at the beginning. Press Play.');
});
$('restart-score').addEventListener('click',()=>startCreate(true));
function changeMode(next){
  if(mode===next)return;
  revision++;busy=false;mode=next;
  audio.pause();engine.clearRemix();music?.stop();transport(false);
  $('create-controls').hidden=mode!=='create';
  document.querySelectorAll('[data-create-only]').forEach(node=>{node.hidden=mode!=='create';});
  $('remix-comparison').hidden=mode!=='remix';
  $('remix-upload').hidden=mode!=='remix';
  $('volume').value=mode==='create'?createVolume:audio.volume;
  document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
  if(mode==='create'){
    if(creative.environmentId!==environment)creative.selectEnvironment(environment);
    syncCreativeControls();
    showGenerated();
    status(selection.pending||selection.current?'Composition ready. Press Play.':'Generate a composition to begin.');
  }else{
    syncRemixControls();
    updateRemix();
    if(!objectURL && audio.getAttribute('src')!==environments[environment].track){
      audio.src=environments[environment].track;audio.load();
    }
    $('soundtrack-label').textContent=objectURL?'LOCAL AUDIO':environments[environment].name.toUpperCase()+' SOUNDTRACK';
    $('track-title').textContent=objectURL?$('file').files[0]?.name||'Local audio':environments[environment].title;
    updateDuration();updateTime();
    status(audio.error?'Soundtrack unavailable. Load your own audio below.':'REMIX ready. Press play or load your own audio.');
  }
}
$('audio-mode').addEventListener('click',event=>{
  const button=event.target.closest('[data-mode]');if(button)changeMode(button.dataset.mode);
});
$('remix-sound').addEventListener('change',event=>{
  remixProcessed=event.target.value==='processed';
  updateRemix();
  updateCreativeHints();
});
$('play').addEventListener('click',async()=>{
  if(busy)return;
  if(mode==='create'){
    if(music?.state==='playing'){music.pause();showGenerated();status('Composition paused'+queueHint());}
    else await startCreate();
    return;
  }
  if(!audio.paused){audio.pause();return;}
  busy=true;
  const attempt=revision;
  const current=()=>attempt===revision;
  try{
    music?.silence();
    await engine.start(current);
  }catch(error){
    if(current()){
      status(audio.error?mediaError():`Cannot play: ${error.message}`);
    }
  }finally{if(current())busy=false;}
});
bindPlaybackShortcut(document,$('play'),()=>!busy && (mode==='create'
  ? Boolean(selection.pending || selection.current)
  : !audio.error && Boolean(audio.currentSrc || audio.getAttribute('src'))));
audio.addEventListener('play',()=>{
  if(mode==='create'){audio.pause();return;}
  if(!audio.paused){transport(true);status('Playing / analysing live audio');}
});
audio.addEventListener('pause',()=>{if(mode==='remix'&&audio.paused){engine.clearRemix();transport(false);status('Paused / signal at rest');}});
audio.addEventListener('error',()=>{if(mode==='remix'){engine.clearRemix();transport(false);status(mediaError());$('seek').disabled=true;}});
function updateDuration(){if(mode==='remix'){$('duration').textContent=format(audio.duration);$('seek').disabled=!Number.isFinite(audio.duration);}}
audio.addEventListener('loadedmetadata',updateDuration);
audio.addEventListener('durationchange',updateDuration);
if(audio.readyState>=1)updateDuration();
function updateTime(){if(mode==='remix'){$('current').textContent=format(audio.currentTime);$('seek').value=Number.isFinite(audio.duration)?audio.currentTime/audio.duration*100:0;}}
audio.addEventListener('timeupdate',updateTime);
$('seek').addEventListener('input',e=>{if(mode==='remix'&&Number.isFinite(audio.duration))audio.currentTime=Number(e.target.value)/100*audio.duration;});
$('volume').addEventListener('input',e=>{
  const value=Number(e.target.value);
  if(mode==='create'){createVolume=value;music?.setVolume(value);}
  else audio.volume=value;
});
$('file').addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  changeMode('remix');
  revision++;busy=false;audio.pause();engine.clearRemix();if(objectURL)URL.revokeObjectURL(objectURL);
  transport(false);
  objectURL=URL.createObjectURL(file);uploadedFile=file;audio.src=objectURL;audio.load();
  $('soundtrack-label').textContent='LOCAL AUDIO';
  $('track-title').textContent=file.name;$('current').textContent='0:00';$('duration').textContent='0:00';$('seek').value=0;$('seek').disabled=true;
  status('Your audio is ready. Press play.');
});
// Meters and renderer consume the same real analyser snapshot, never simulated values.
function frame(time){
  const signal=engine.sample();
  if(mode==='create'&&music?.state==='playing')showCreatePosition();
  let renderField;
  if(environment==='cyberpunk'){
    const live=engine.active;
    cyberHud.frame(time,signal,live,mode==='remix'?audio.error:null,parameters);
    if(cyberHud.isParticleView())renderField=cyberHud.render;
  }
  draw(time,signal,environments[environment],style,parameters,pointer.sample(time),renderField,mode==="create"?music?.state==="playing":!audio.paused&&!audio.ended);
  for(const name of ['bass','mid','high','level'])$(name).value=signal[name];
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)music?.tick();});
window.addEventListener('pagehide',event=>{
  revision++;busy=false;
  audio.pause();engine.clearRemix();
  if(objectURL&&!event.persisted)URL.revokeObjectURL(objectURL);
  music?.dispose();music=null;
  if(mode==='create'){showGenerated();status('Composition ready. Press Play.');}
});

// Style selection deliberately never touches the audio element or AudioEngine.
function updateSelection(){
  document.querySelectorAll('[data-environment]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.environment===environment)));
  document.querySelectorAll('[data-style]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.style===style)));
  $('style-label').textContent=styles[style].toUpperCase();
  $('combination').textContent=environments[environment].name.toUpperCase()+' × '+styles[style].toUpperCase();
  document.querySelector('.stage').setAttribute('aria-label',environments[environment].name+' '+styles[style]+' audio visualizer');
}
$('styles').addEventListener('click',event=>{
  const button=event.target.closest('[data-style]');if(!button)return;
  style=button.dataset.style;
  if(environment==='cyberpunk')cyberHud.showStyle();
  updateSelection();
});
$('environments').addEventListener('click',async event=>{
  const button=event.target.closest('[data-environment]');if(!button||button.dataset.environment===environment)return;
  const resume=!audio.paused;
  environment=button.dataset.environment;const preset=environments[environment];
  style=preset.defaultStyle;
  document.body.dataset.environment=environment;
  cyberHud.show(environment==='cyberpunk');
  $('environment-title').textContent=preset.name;
  document.title='RESONA — '+preset.name;
  $('environment-description').textContent=preset.description;
  $('stage-identifier').textContent=preset.stageIdentifier??'';
  document.querySelector('.stage-caption').textContent=preset.caption;
  document.querySelector('.depth').textContent=preset.detail;
  if(mode==='create'){
    creative.selectEnvironment(environment);
    syncCreativeControls();
    showGenerated();updateSelection();
    status(`${preset.name} selected for the next generation.`+queueHint());
    return;
  }
  updateRemix();
  updateSelection();
  if(objectURL)return;
  const attempt=++revision;
  busy=false;audio.pause();engine.clearRemix();transport(false);
  $('soundtrack-label').textContent=preset.name.toUpperCase()+' SOUNDTRACK';
  $('track-title').textContent=preset.title;
  $('seek').value=0;$('seek').disabled=true;$('current').textContent='0:00';$('duration').textContent='0:00';
  audio.src=preset.track;audio.load();
  status('Loading '+preset.name+' soundtrack…');
  if(resume){try{music?.silence();await engine.start(()=>attempt===revision);}catch(error){if(attempt===revision)status('Soundtrack unavailable or playback blocked. Load audio below, then press play.');}}
  else status(preset.name+' selected. Press play, or load your own audio.');
});

// Keep visual controls synchronized without seeking or changing the audio source.
function syncControls(){
  for(const [name,value] of Object.entries(parameters)){
    $(name).value=value;$(name+'-value').value=String(value);
  }
}
document.querySelectorAll('[data-parameter]').forEach(input=>{
  input.addEventListener('input',()=>{
    const name=input.dataset.parameter;
    parameters[name]=Number(input.value);
    $(name+'-value').value=input.value;
    if(mode==='create'){
      setCreative(name,parameters[name]);
      if(name==='speed')updateCreativeHints();
    }else{
      remixValues[name]=parameters[name];
      if(name==='color'||name==='distortion')updateRemix();
    }
  });
});
document.querySelectorAll('[data-creative]').forEach(input=>{
  input.addEventListener('input',()=>{
    const name=input.dataset.creative;
    if(mode==='create')setCreative(name,Number(input.value));
    else if(name==='energy'||name==='space'){
      remixValues[name]=Number(input.value);
      updateRemix();
    }else return;
    $(name+'-value').value=input.value;
  });
});
$('reset-creative').addEventListener('click',()=>{
  if(mode==='create'){
    creative.reset();
    syncCreativeControls();
    if(creative.live)music?.setControls(creative.live);
  }else{
    Object.assign(remixValues,remixProfiles[environment].defaults);
    syncRemixControls();
    updateRemix();
  }
  $('control-status').textContent='';
  $('control-status').hidden=true;
});
$('break-everything').addEventListener('click',()=>{
  style=randomizeVisuals(parameters,Object.keys(styles));
  // Keep simultaneous drive, dynamics and room changes below their manual extremes.
  parameters.distortion=Math.round(parameters.distortion*.65);
  const randomBetween=(min,max)=>min+Math.floor(Math.random()*(max-min+1));
  const values={...parameters,energy:randomBetween(20,75),space:randomBetween(15,78)};
  if(mode==='create'){
    values.density=randomBetween(0,100);
    values.melody=randomBetween(30,95);
    for(const [name,value] of Object.entries(values))setCreative(name,value,false);
    syncCreativeControls();
    if(creative.live)music?.setControls(creative.live);
  }else{
    Object.assign(remixValues,values);
    syncRemixControls();
    updateRemix();
  }
  updateSelection();
  $('control-status').hidden=false;
  $('control-status').textContent='Remixed / '+styles[style]+' / '+Object.entries(values).map(([name,value])=>name+' '+value).join(', ');
});
syncRemixControls();
updateRemix();

const clearExportDownload=bindExportControls({
  wav:$('export-wav'),mp3:$('export-mp3'),status:$('export-status'),download:$('export-download'),
  snapshot(){
    if(mode==='create'){
      const active=music?.state==='playing'||music?.state==='paused';
      const score=active?selection.current:selection.pending??selection.current;
      if(!score)throw new Error('Generate a composition first.');
      const controls=creative.score===score?creative.live:
        score.environmentId===environment?creative.capture():score.liveDefaults;
      return { mode,score,controls:{...controls},volume:createVolume,
        name:`sonic-chaos-${score.environmentId}-seed-${score.seed}` };
    }
    if(audio.error)throw new Error(mediaError());
    return { mode,file:uploadedFile,src:audio.currentSrc||audio.getAttribute('src'),
      duration:audio.duration,environment,processed:remixProcessed,controls:{...remixValues},
      volume:audio.volume,name:'sonic-chaos-remix-'+(remixProcessed?'processed':'original') };
  }
});
window.addEventListener('pagehide',clearExportDownload);
