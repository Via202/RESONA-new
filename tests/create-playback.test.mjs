import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../js/audio.js';
import { generateComposition } from '../js/composition/planner.js';
import { createEvent } from '../js/composition/score.js';
import { CreatePlayback } from '../js/create/scheduler.js';
import { CreateSelection } from '../js/create/selection.js';
import { prepareScore } from '../js/create/score.js';
import { controlDefaults, generationSettings } from '../js/create/controls.js';
import { spaceSettings } from '../js/create/ambience.js';

const note = (order, tick, duration, layer = 'chords') => createEvent(order, tick, duration, {
  layer, kind: 'note', pitches: [60], velocity: .6
});
const drum = createEvent(1, 48, 18, { layer: 'percussion', kind: 'hit', instrument: 'kick', velocity: .5 });
const fixture = () => ({
  ...generateComposition({ environmentId: 'space', tempo: 240 }),
  events: [note(0, 0, 384), drum, note(2, 192, 48, 'melody'), note(3, 12192, 192)]
});
const closeTo = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('750 settings and seed combinations validate and reproduce the same immutable events', () => {
  for (const [environmentId, defaults] of Object.entries(controlDefaults)) {
    for (let seed = 0; seed < 30; seed++) {
      for (const [density, chaos, speed] of [[0, 0, 0], [0, 100, 100], [100, 0, 100], [100, 100, 0], [50, 50, 50]]) {
        const options = { environmentId, seed, ...generationSettings(environmentId, { ...defaults, density, chaos, speed }) };
        const score = generateComposition(options);
        const prepared = prepareScore(score);
        assert.equal(score.barCount, 32);
        assert.ok(Object.isFrozen(score.events) && score.events.every(Object.isFrozen));
        assert.deepEqual(score, generateComposition(options));
        assert.equal(prepared.events.length, score.events.length);
      }
    }
  }
});

function rig({ failOrder } = {}) {
  const context = new EventTarget();
  Object.assign(context, { currentTime: 1, state: 'running', sampleRate: 48000 });
  const outputs = new Set();
  const intervals = new Set();
  const timeouts = new Map();
  const voices = [];
  const errors = [];
  const timers = {
    setInterval(callback) { intervals.add(callback); return callback; },
    clearInterval(callback) { intervals.delete(callback); },
    setTimeout(callback, delay) { timeouts.set(callback, context.currentTime + delay / 1000); return callback; },
    clearTimeout(callback) { timeouts.delete(callback); }
  };
  function node() {
    const links = new Set();
    return {
      links, context, connect(target) { links.add(target); },
      disconnect(target) { if (target) links.delete(target); else links.clear(); }
    };
  }
  context.createGain = () => ({
    ...node(),
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {},
      cancelScheduledValues() {}, setTargetAtTime(value, time, constant) {
        this.value = value;
        this.lastTarget = { value, time, constant };
      } }
  });
  const reverbs = [];
  context.createBiquadFilter = () => ({ ...node(), frequency: { value: 0 }, Q: { value: 0 },
    gain: { value: 0, setTargetAtTime(value) { this.value = value; } } });
  context.createWaveShaper = () => node();
  context.createConvolver = () => {
    const reverb = node();
    reverbs.push(reverb);
    return reverb;
  };
  context.createBuffer = (channels, length) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: index => data[index] };
  };
  context.destination = node();
  const config = {
    context, timers, connect: bus => outputs.add(bus), disconnect: bus => outputs.delete(bus),
    onError: error => errors.push(error),
    scheduleVoice(options) {
      if (options.event.order === failOrder) throw new Error('test voice failure');
      let finish;
      const voice = {
        ...options, startTime: options.time, endsAt: options.time + options.duration - options.offset + .06,
        done: new Promise(resolve => { finish = resolve; }),
        release(at) { this.releasedAt = at; },
        cancel() { this.cancelled = true; finish(); },
        finish
      };
      voices.push(voice);
      return voice;
    }
  };
  const player = new CreatePlayback(config);
  async function advance(to) {
    while (context.currentTime + 1e-9 < to) {
      context.currentTime = Math.min(to, context.currentTime + .02);
      for (const voice of voices) if (voice.endsAt <= context.currentTime) voice.finish();
      for (const [callback, at] of timeouts) if (at <= context.currentTime) { timeouts.delete(callback); callback(); }
      for (const callback of intervals) callback();
      await Promise.resolve();
    }
  }
  return { player, context, outputs, intervals, timeouts, voices, errors, advance, node, config, reverbs };
}

test('score preparation validates all generated environments, absolute timing data and invalid events', () => {
  for (const environmentId of ['underwater', 'dreamcore', 'space', 'retro', 'cyberpunk']) {
    const score = generateComposition({ environmentId, seed: 1 });
    const prepared = prepareScore(score);
    assert.equal(prepared.events.length, score.events.length);
    closeTo(prepared.cycleSeconds, 32 * 4 * 60 / score.tempo);
    const last = prepared.events.find(({ event }) => event.carryTicks);
    closeTo(last.at + last.duration - prepared.cycleSeconds, 60 / score.tempo);
  }
  const score = fixture();
  const prepared = prepareScore(score);
  assert.notEqual(prepared.events[0].event, score.events[0]);
  assert.ok(Object.isFrozen(prepared.events[0].event.pitches));
  for (const invalid of [
    { ...score, tempo: 0 }, { ...score, loop: { ...score.loop, endTickExclusive: 12289 } },
    { ...score, events: [score.events[0], score.events[0]] },
    { ...score, events: [...score.events].reverse() },
    { ...score, events: [{ ...score.events[0], pitches: [130] }] },
    { ...score, events: [{ ...drum, instrument: 'invalid' }] },
    { ...score, events: [{ ...score.events.at(-1), carryTicks: 0 }] }
  ]) assert.throws(() => prepareScore(invalid), RangeError);
});

test('look-ahead schedules exactly one onset per event per cycle and leaves the carry running across three seams', async () => {
  const { player, voices, advance, intervals, outputs } = rig();
  const score = prepareScore(fixture());
  player.play(score);
  player.play(score);
  assert.equal(intervals.size, 1);
  assert.equal(outputs.size, 1);
  closeTo(voices[0].time, 1.05);
  assert.ok(voices.every(voice => voice.time <= 1.14));
  await advance(1.15 + score.cycleSeconds * 3);
  assert.equal(player.position.cycle, 3);
  for (let cycle = 0; cycle <= 3; cycle++) {
    const opening = voices.filter(voice => voice.event.order === 0 &&
      Math.abs(voice.time - (1.05 + cycle * score.cycleSeconds)) < 1e-7);
    assert.equal(opening.length, 1);
    if (cycle === 3) continue;
    const carry = voices.find(voice => voice.event.order === 3 &&
      Math.abs(voice.time - (1.05 + cycle * score.cycleSeconds + score.events.at(-1).at)) < 1e-7);
    closeTo(carry.duration, score.events.at(-1).duration);
    assert.ok(carry.endsAt > 1.05 + (cycle + 1) * score.cycleSeconds);
    assert.equal(carry.cancelled, undefined);
  }
  assert.ok(voices.every(voice => voice.offset === 0));
  player.dispose();
  assert.equal(intervals.size, 0);
  assert.equal(outputs.size, 0);
});

test('pause freezes fractional ticks and resumes the original gates, including a previous-cycle carry', async () => {
  const { player, context, voices, advance, intervals } = rig();
  const score = prepareScore(fixture());
  player.play(score);
  await advance(1.05 + score.cycleSeconds + 70.25 * score.secondsPerTick);
  player.pause();
  assert.equal(player.state, 'paused');
  assert.equal(player.position.cycle, 1);
  closeTo(player.position.tick, 70.25);
  assert.equal(intervals.size, 0);
  const paused = player.position;
  await advance(context.currentTime + 2);
  assert.deepEqual(player.position, paused);
  const count = voices.length;
  const resumeTime = context.currentTime + .05;
  player.play(score);
  const restored = voices.slice(count).filter(voice => voice.offset > 0);
  assert.deepEqual(restored.map(voice => voice.event.order), [3, 0]);
  closeTo(restored[0].offset, (96 + 70.25) * score.secondsPerTick);
  closeTo(restored[1].offset, 70.25 * score.secondsPerTick);
  assert.ok(restored.every(voice => Math.abs(voice.startTime - resumeTime) < 1e-7));
  await advance(resumeTime + (192 - 70.25) * score.secondsPerTick + .01);
  assert.ok(voices.slice(count).some(voice => voice.event.order === 2 && voice.offset === 0));
  assert.equal(voices.slice(count).filter(voice => voice.event.order === 1).length, 0);
  player.dispose();
});

test('late polling skips expired onsets and restart, stop, suspension and closure clean up one run', async () => {
  const { player, context, advance, intervals, outputs, voices, errors } = rig();
  const score = prepareScore(fixture());
  player.play(score);
  context.state = 'suspended';
  context.dispatchEvent(new Event('statechange'));
  const count = voices.length;
  player.tick();
  assert.equal(voices.length, count);
  context.currentTime = 1.45;
  context.state = 'running';
  context.dispatchEvent(new Event('statechange'));
  assert.ok(voices.slice(count).every(voice => voice.time >= context.currentTime));
  const beforeRestart = voices.length;
  player.restart();
  assert.equal(intervals.size, 1);
  assert.deepEqual(player.position, { cycle: 0, tick: 0, bar: 1 });
  const restarted = voices[beforeRestart];
  assert.equal(restarted.event.order, 0);
  player.stop(); player.stop();
  assert.equal(intervals.size, 0);
  await advance(1.55);
  assert.equal(outputs.size, 0);
  player.play(score);
  context.state = 'closed';
  context.dispatchEvent(new Event('statechange'));
  assert.equal(errors.length, 1);
  assert.equal(intervals.size, 0);
  assert.equal(outputs.size, 0);
  player.dispose(); player.dispose();
});

test('a scheduling failure stops the run and clears its routing and queued nodes', async () => {
  const { player, advance, errors, outputs, intervals, voices } = rig({ failOrder: 2 });
  player.play(prepareScore(fixture()));
  await advance(1.6);
  assert.equal(errors.length, 1);
  assert.equal(player.state, 'stopped');
  assert.equal(outputs.size, 0);
  assert.equal(intervals.size, 0);
  assert.ok(voices.every(voice => voice.cancelled || voice.endsAt <= 1.6));
});

test('live CREATE controls update a single run graph and preserve the audio clock and dry chord path', async () => {
  const { player, context, voices, intervals, outputs, reverbs, advance } = rig();
  player.setControls(controlDefaults.retro);
  player.play(prepareScore({ ...fixture(), environmentId: 'retro' }));
  await advance(1.6);
  const position = player.position;
  const chord = voices.find(voice => voice.event.layer === 'chords');
  const lead = voices.find(voice => voice.event.layer === 'melody');
  const drum = voices.find(voice => voice.event.layer === 'percussion');
  const wet = [...[...reverbs[0].links][0].links][0];
  player.setControls({ ...controlDefaults.retro, melody: 0, energy: 100, space: 0, distortion: 100, color: 100 });
  assert.equal(lead.output.gain.value, 0);
  assert.equal(chord.output.gain.value, .98);
  assert.ok(drum.output.gain.value > 1);
  assert.equal(wet.gain.value, 0);
  assert.deepEqual(player.position, position);
  assert.equal(intervals.size, 1);
  assert.equal(reverbs.length, 2);
  assert.deepEqual([...outputs], [player.master]);
  player.setControls({ ...controlDefaults.retro, melody: 100, space: 50 });
  assert.equal(wet.gain.value, spaceSettings('retro', .5).wet);
  assert.deepEqual(wet.gain.lastTarget, { value: spaceSettings('retro', .5).wet, time: context.currentTime, constant: .08 });
  player.setControls({ ...controlDefaults.retro, melody: 100, space: 100 });
  assert.equal(lead.output.gain.value, 1.12);
  assert.equal(wet.gain.value, .84);
  assert.equal(reverbs[0].normalize, false);
  assert.equal(reverbs[0].buffer.getChannelData(0).length, context.sampleRate * .38);
  const energy = reverbs[0].buffer.getChannelData(0).reduce((sum, value) => sum + value * value, 0);
  assert.ok(Math.abs(Math.sqrt(energy) - .95) < 1e-6);
  player.dispose();
  assert.equal(outputs.size, 0);
  assert.equal(lead.output.links.size, 0);
  assert.equal(reverbs[0].buffer, null);
  assert.equal(reverbs[1].buffer, null);
});

test('Space shares one filtered stereo reverb across the loop and disposes it with the run', async () => {
  const { player, context, outputs, voices, reverbs, advance } = rig();
  const score = prepareScore(fixture());
  player.play(score);
  assert.equal(reverbs.length, 1);
  const [convolver] = reverbs;
  const impulse = convolver.buffer;
  const left = impulse.getChannelData(0), right = impulse.getChannelData(1);
  assert.equal(left.length, context.sampleRate * 3.2);
  assert.equal(left[100], 0);
  assert.notEqual(left[2000], right[2000]);
  assert.ok(Math.abs(left.at(-10)) < .001);
  const [dry, chordSend] = voices[0].output.links;
  const [high] = chordSend.links;
  const [low] = high.links;
  assert.equal(high.type, 'highpass');
  assert.equal(high.frequency.value, 220);
  assert.equal(low.frequency.value, 4700);
  assert.equal([...low.links][0], convolver);
  const [wet] = convolver.links;
  assert.ok(wet.gain.value * chordSend.gain.value < .5);
  assert.deepEqual([...wet.links], [dry]);
  assert.deepEqual([...dry.links], [player.master]);
  assert.deepEqual([...outputs], [player.master]);
  await advance(1.18 + score.cycleSeconds);
  const drumVoice = voices.find(voice => voice.event.layer === 'percussion');
  assert.ok([...drumVoice.output.links][1].gain.value < chordSend.gain.value);
  assert.equal(reverbs.length, 1);
  assert.equal(convolver.buffer, impulse);
  player.pause();
  await advance(context.currentTime + .05);
  assert.equal(convolver.links.size, 0);
  assert.equal(convolver.buffer, null);
  assert.equal(outputs.size, 0);
  player.play(score);
  assert.equal(reverbs.length, 2);
  assert.equal(reverbs[1].buffer, impulse);
  player.stop();
  player.silence();
  for (const environmentId of ['underwater', 'dreamcore', 'retro', 'cyberpunk']) {
    player.play(prepareScore({ ...fixture(), environmentId }));
    assert.equal(reverbs.length, 2);
    player.stop();
    player.silence();
  }
  player.dispose();
  assert.ok(reverbs.every(node => !node.links.size && node.buffer === null));
});

test('high Space keeps both room tails across loops and clears them on pause, stop and restart', async () => {
  for (const environmentId of ['underwater', 'dreamcore', 'space', 'retro', 'cyberpunk']) {
    const { player, context, outputs, reverbs, intervals, advance } = rig();
    const score = prepareScore({ ...fixture(), environmentId });
    player.setControls({ ...controlDefaults[environmentId], space: 100 });
    player.play(score);
    const buffers = reverbs.map(node => node.buffer);
    const run = player.run;
    await advance(1.18 + score.cycleSeconds);
    assert.equal(reverbs.length, 2);
    assert.equal(player.run, run);
    assert.deepEqual(reverbs.map(node => node.buffer), buffers);
    player.pause();
    const position = player.position;
    await advance(context.currentTime + .05);
    assert.deepEqual(player.position, position);
    assert.ok(reverbs.every(node => !node.links.size && node.buffer === null));
    player.play(score);
    assert.deepEqual(player.position, position);
    assert.deepEqual(reverbs.slice(-2).map(node => node.buffer), buffers);
    await advance(context.currentTime + .1);
    player.restart();
    assert.deepEqual(player.position, { cycle: 0, tick: 0, bar: 1 });
    assert.equal(intervals.size, 1);
    await advance(context.currentTime + .1);
    assert.ok(reverbs.slice(0, -2).every(node => !node.links.size && node.buffer === null));
    player.stop();
    await advance(context.currentTime + .05);
    assert.equal(outputs.size, 0);
    assert.ok(reverbs.every(node => !node.links.size && node.buffer === null));
    player.dispose();
  }
});

test('25 high-Space playback sessions release each retired graph, timer and voice set', async () => {
  const { player, context, outputs, intervals, timeouts, reverbs, advance, errors } = rig();
  for (const [environmentId, defaults] of Object.entries(controlDefaults)) {
    for (let seed = 0; seed < 5; seed++) {
      const score = prepareScore(generateComposition({ environmentId, seed, density: 100, chaos: 100 }));
      player.setControls({ ...defaults, space: 100 });
      player.play(score);
      const original = player.run;
      await advance(context.currentTime + 1.4);
      assert.equal(intervals.size, 1);
      assert.deepEqual([...outputs], [player.master]);
      player.pause();
      const position = player.position;
      player.play(score);
      assert.deepEqual(player.position, position);
      await advance(context.currentTime + .12);
      assert.equal(original.voices.size, 0);
      const resumed = player.run;
      player.restart();
      assert.equal(player.position.tick, 0);
      assert.equal(intervals.size, 1);
      await advance(context.currentTime + .12);
      assert.equal(resumed.voices.size, 0);
      const restarted = player.run;
      player.stop();
      await advance(context.currentTime + .06);
      assert.equal(restarted.voices.size, 0);
      assert.equal(intervals.size + timeouts.size + outputs.size, 0);
      assert.ok(reverbs.every(node => !node.links.size && node.buffer === null));
    }
  }
  assert.deepEqual(errors, []);
  player.dispose();
});

test('generation is transactional and replacement does not alter the current score on resume or restart', () => {
  const selection = new CreateSelection(options => {
    if (options.seed === -1) throw new Error('generator failed');
    return generateComposition(options);
  });
  const first = selection.generate({ environmentId: 'underwater', seed: 1 });
  assert.ok(Object.isFrozen(first.composition));
  assert.equal(selection.select(), first);
  const second = selection.generate({ environmentId: 'cyberpunk', seed: 2 });
  assert.throws(() => selection.generate({ environmentId: 'retro', seed: -1 }), /generator failed/);
  assert.throws(() => selection.generate({ environmentId: 'retro', tempo: 900 }), RangeError);
  assert.equal(selection.pending, second);
  assert.equal(selection.select({ resume: true }), first);
  assert.equal(selection.select({ restart: true }), first);
  assert.equal(selection.select(), second);
  assert.equal(selection.pending, null);
});

test('CREATE attaches to the existing analyser and detaches without changing media routing or gain', async () => {
  const { player: unused, config, context, node } = rig();
  unused.dispose();
  const analyser = Object.assign(node(), { frequencyBinCount: 1024 });
  const mediaNode = node();
  let created = 0;
  let analysers = 0;
  context.createAnalyser = () => { analysers++; return analyser; };
  context.createMediaElementSource = () => mediaNode;
  context.resume = async () => {};
  const media = { paused: true, volume: .7, async play() { this.paused = false; } };
  const previousWindow = globalThis.window;
  globalThis.window = { AudioContext: class { constructor() { created++; return context; } } };
  try {
    const audio = new AudioEngine(media);
    await audio.resume();
    const player = new CreatePlayback({
      ...config, connect: output => audio.connectExternal(output), disconnect: output => audio.disconnectExternal(output)
    });
    player.setVolume(.3);
    player.play(prepareScore(fixture()));
    assert.equal(audio.active, true);
    assert.equal(media.paused, true);
    assert.deepEqual([...audio.external], [player.master]);
    assert.deepEqual([...player.master.links], [analyser]);
    player.stop();
    player.silence();
    await audio.start();
    assert.equal(created, 1);
    assert.equal(analysers, 1);
    assert.equal(media.volume, .7);
    assert.equal(audio.external.size, 0);
    assert.deepEqual([...mediaNode.links], [analyser]);
    assert.deepEqual([...analyser.links], [context.destination]);
    player.dispose();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
