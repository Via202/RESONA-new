import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveObjectURL } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { remixProfiles } from '../js/remix-profiles.js';
import { generationSettings, controlDefaults } from '../js/create/controls.js';

class Element extends EventTarget {
  constructor() {
    super();
    this.value = '';
    this.children = [{}, {}];
    this.dataset = {};
  }
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
  getAttribute(name) { return this[name]; }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  prepend() {}
  getContext() { return { setTransform() {} }; }
  getBoundingClientRect() { return { width: 640, height: 360 }; }
  pause() { this.paused = true; }
  load() { this.loads = (this.loads ?? 0) + 1; this.currentTime = 0; }
}

test('built-ins follow the world while uploads and REMIX reset preserve recording and transport', async t => {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const document = Object.assign(new Element(), { getElementById: get, body: new Element() });
  const visualNames = ['chaos', 'speed', 'color', 'distortion'];
  const creativeNames = ['energy', 'space', 'density', 'melody'];
  document.querySelectorAll = selector => {
    if (selector === '[data-parameter]') return visualNames.map(name =>
      Object.assign(get(name), { dataset: { parameter: name } }));
    if (selector === '[data-creative]') return creativeNames.map(name =>
      Object.assign(get(name), { dataset: { creative: name } }));
    return [];
  };
  const globals = {
    document, window: new EventTarget(), ResizeObserver: class { observe() {} },
    devicePixelRatio: 1, matchMedia: () => ({ matches: false }), requestAnimationFrame() {}
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  const audio = get('audio');
  audio.paused = true;
  await import('../js/app.js');
  assert.equal(get('track-title').textContent, 'Del Erad');

  const picker = get('file');
  const file = new File(['fixture'], 'track.wav', { type: 'audio/wav' });
  function chooseSameFile() {
    // The native picker emits change only when its selected file changes.
    if (picker.value === file.name) return;
    picker.value = file.name;
    picker.files = [file];
    picker.dispatchEvent(new Event('change'));
  }
  function select(id, dataset) {
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: { closest: () => ({ dataset }) } });
    get(id).dispatchEvent(event);
  }
  function move(name, value) {
    get(name).value = String(value);
    get(name).dispatchEvent(new Event('input'));
  }
  t.after(() => {
    if (audio.src?.startsWith('blob:')) URL.revokeObjectURL(audio.src);
  });

  select('environments', { environment: 'dreamcore' });
  assert.equal(audio.src, 'assets/audio/A Lucid Dream.mp3');
  assert.equal(get('track-title').textContent, 'A Lucid Dream');
  chooseSameFile();
  const first = audio.src;
  assert.match(first, /^blob:/);
  audio.currentTime = 12;
  audio.paused = false;
  const loads = audio.loads;
  get('remix-sound').value = 'processed';
  get('remix-sound').dispatchEvent(new Event('change'));
  move('color', 81);
  move('chaos', 68);
  select('environments', { environment: 'space' });
  assert.equal(audio.src, first);
  assert.ok(resolveObjectURL(first));
  assert.equal(audio.currentTime, 12);
  assert.equal(audio.paused, false);
  assert.equal(audio.loads, loads);
  assert.equal(Number(get('color').value), 81);
  assert.equal(get('track-title').textContent, 'track.wav');
  assert.equal(get('soundtrack-label').textContent, 'LOCAL AUDIO');
  assert.equal(get('environment-title').textContent, 'Space');
  assert.equal(get('stage-identifier').textContent, 'SP—03');
  assert.equal(get('combination').textContent, 'SPACE × GEOMETRIC');
  select('styles', { style: 'glitch' });
  assert.equal(get('combination').textContent, 'SPACE × SOUNDWAVE');
  assert.equal(get('stage-identifier').textContent, 'SP—03');
  select('audio-mode', { mode: 'create' });
  assert.equal(get('remix-upload').hidden, true);
  move('color', 97);
  select('audio-mode', { mode: 'remix' });
  assert.equal(get('remix-upload').hidden, false);
  assert.equal(audio.paused, true);
  assert.equal(audio.src, first);
  assert.equal(audio.currentTime, 12);
  assert.equal(Number(get('color').value), 81);
  assert.equal(Number(get('chaos').value), 68);
  get('reset-creative').dispatchEvent(new Event('click'));
  for (const [key, value] of Object.entries(remixProfiles.space.defaults)) assert.equal(Number(get(key).value), value);
  assert.equal(get('remix-sound').value, 'processed');
  assert.equal(get('control-status').hidden, true);
  assert.equal(audio.src, first);
  assert.equal(audio.currentTime, 12);
  assert.equal(audio.paused, true);
  assert.equal(audio.loads, loads);
  select('audio-mode', { mode: 'create' });
  assert.equal(Number(get('color').value), 97);
  get('generate-score').dispatchEvent(new Event('click'));
  const preparedTitle = get('track-title').textContent;
  const randomize = () => {
    const original = Math.random;
    Math.random = () => .99;
    try { get('break-everything').dispatchEvent(new Event('click')); }
    finally { Math.random = original; }
  };
  const values = names => Object.fromEntries(names.map(name => [name, Number(get(name).value)]));
  randomize();
  const changed = values([...visualNames, ...creativeNames]);
  assert.deepEqual(changed, { chaos: 99, speed: 99, color: 99, distortion: 64, energy: 75, space: 78, density: 99, melody: 95 });
  for (const [key, value] of Object.entries(changed)) assert.equal(get(key+'-value').value, String(value));
  assert.equal(get('track-title').textContent, preparedTitle);
  const tempo = generationSettings('space', changed).tempo;
  assert.equal(get('speed-hint').children[1].textContent, tempo+' BPM');
  get('generate-score').dispatchEvent(new Event('click'));
  assert.match(get('track-title').textContent, new RegExp(tempo+' BPM · Seed 1$'));
  get('reset-creative').dispatchEvent(new Event('click'));
  assert.deepEqual(values(Object.keys(controlDefaults.space)), controlDefaults.space);
  select('audio-mode', { mode: 'remix' });
  randomize();
  assert.deepEqual(values(Object.keys(remixProfiles.space.defaults)), {
    chaos: 99, speed: 99, color: 99, distortion: 64, energy: 75, space: 78
  });
  assert.equal(Number(get('density').value), controlDefaults.space.density);
  assert.equal(Number(get('melody').value), controlDefaults.space.melody);
  assert.equal(audio.src, first);
  assert.equal(audio.currentTime, 12);
  assert.equal(audio.paused, true);
  assert.equal(audio.loads, loads);
  assert.equal(get('remix-sound').value, 'processed');
  audio.dispatchEvent(new Event('error'));
  assert.equal(get('seek').disabled, true);
  assert.match(get('status').textContent, /audio file could not be played/);
  const second = audio.src;
  audio.paused = false;
  audio.dispatchEvent(new Event('play'));
  assert.equal(get('play').getAttribute('aria-label'), 'Pause audio');
  picker.value = 'replacement.wav';
  picker.files = [new File(['fixture 2'], picker.value, { type: 'audio/wav' })];
  picker.dispatchEvent(new Event('change'));
  assert.equal(resolveObjectURL(second), undefined);
  assert.match(audio.src, /^blob:/);
  assert.equal(get('track-title').textContent, 'replacement.wav');
  assert.equal(get('play').getAttribute('aria-label'), 'Play audio');
  const saved = new Event('pagehide');
  Object.defineProperty(saved, 'persisted', { value: true });
  globals.window.dispatchEvent(saved);
  assert.ok(resolveObjectURL(audio.src));
  globals.window.dispatchEvent(new Event('pagehide'));
  assert.equal(resolveObjectURL(audio.src), undefined);
});

test('REMIX comparison has an accessible name and the file input lives inside the hidden upload control', () => {
  const html = readFileSync(new URL('../experience.html', import.meta.url), 'utf8');
  assert.match(html, /<select id="remix-sound" aria-label="Audio processing mode">/);
  assert.doesNotMatch(html, />REMIX sound </);
  assert.match(html, /<label id="remix-upload"[^>]*>[^<]*<input id="file" type="file"/);
});


test('initial environment text, canvas identifiers and HUD copy match the release markup', async () => {
  const { environments } = await import('../js/environments.js');
  const html = readFileSync(new URL('../experience.html', import.meta.url), 'utf8');
  const initialDescription = html.match(/id="environment-description">([^<]+)<\/p>/)?.[1];
  assert.equal(initialDescription, environments.underwater.description);
  const identifiers = Object.values(environments).map(env => env.stageIdentifier).filter(Boolean);
  assert.equal(identifiers.length, 4);
  assert.equal(new Set(identifiers).size, 4);
  assert.ok(html.includes('id="stage-identifier">'+environments.underwater.stageIdentifier));
  assert.match(html, /class="hud-index">● PHOSPHOR SYSTEMS<\/span>/);
  assert.match(environments.cyberpunk.caption, /^“.+”$/);
  assert.match(html, /LISTEN\. WATCH\. AND FEEL\./);
  assert.doesNotMatch(html, /STAGE 06|[↗↘]/);
});