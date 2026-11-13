import test from 'node:test';
import assert from 'node:assert/strict';
import { generateComposition } from '../js/composition/planner.js';
import { midiToFrequency, scheduleInstrumentEvent, soundProfiles } from '../js/instruments/index.js';

function rig({ hold = true, failConnect = false } = {}) {
  const nodes = [];
  const sources = [];
  const buffers = [];
  const context = { currentTime: 1, sampleRate: 48000, state: 'running' };
  function param() {
    const calls = [];
    const result = { calls, value: 0 };
    for (const method of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
      'cancelScheduledValues', ...(hold ? ['cancelAndHoldAtTime'] : [])]) {
      result[method] = (...args) => calls.push([method, ...args]);
    }
    return result;
  }
  function node(kind) {
    const result = {
      context, kind, connections: [], disconnects: 0,
      connect(target) {
        if (failConnect && target === output) throw new Error('connection failed');
        this.connections.push(target);
        return target;
      },
      disconnect() { this.connections.length = 0; this.disconnects++; }
    };
    nodes.push(result);
    return result;
  }
  function source(kind) {
    const result = Object.assign(node(kind), {
      starts: [], stops: [],
      start(time) {
        assert.equal(this.starts.length, 0);
        this.starts.push(time);
      },
      stop(time) {
        assert.equal(this.starts.length, 1);
        this.stops.push(time);
      }
    });
    sources.push(result);
    return result;
  }
  context.destination = node('destination');
  const output = node('output');
  context.createGain = () => Object.assign(node('gain'), { gain: param() });
  context.createBiquadFilter = () => Object.assign(node('filter'), { frequency: param(), Q: param() });
  context.createOscillator = () => Object.assign(source('oscillator'), { frequency: param(), detune: param() });
  context.createBufferSource = () => source('buffer');
  context.createBuffer = (channels, length, sampleRate) => {
    assert.equal(channels, 1);
    assert.equal(sampleRate, context.sampleRate);
    const data = new Float32Array(length);
    const buffer = { getChannelData: () => data };
    buffers.push(buffer);
    return buffer;
  };
  return { context, output, nodes, sources, buffers };
}

const bass = { layer: 'bass', kind: 'note', pitches: [45], velocity: .7 };
const chord = { layer: 'chords', kind: 'chord', pitches: [60, 64, 67], velocity: .8 };
const hit = instrument => ({ layer: 'percussion', kind: 'hit', instrument, velocity: .65 });
const play = (graph, event, options) => scheduleInstrumentEvent({
  context: graph.context, output: graph.output, environmentId: 'underwater',
  event, time: 2, duration: .5, ...options
});

test('ambient hats route softened filtered noise and Space lead reaches its attack peak sooner', async () => {
  for (const [environmentId, cutoff, gain] of [['underwater', 1250, .07], ['dreamcore', 1900, .08]]) {
    const graph = rig();
    const voice = play(graph, hit('hat'), { environmentId });
    const filter = graph.nodes.find(node => node.type === 'bandpass');
    const envelope = graph.nodes.find(node => node.connections.includes(graph.output));
    assert.deepEqual(graph.sources.map(node => node.kind), ['buffer']);
    assert.equal(filter.frequency.value, cutoff);
    assert.deepEqual(envelope.gain.calls[1], ['linearRampToValueAtTime', gain * .65, 2.009]);
    voice.cancel();
    assert.equal(await voice.done, 'cancelled');
  }
  const graph = rig();
  const voice = play(graph, { ...bass, layer: 'melody', pitches: [74] }, { environmentId: 'space' });
  const envelope = graph.nodes.find(node => node.connections.includes(graph.output));
  assert.equal(voice.startTime, 2);
  assert.deepEqual(envelope.gain.calls[1], ['linearRampToValueAtTime', .14 * .7, 2.028]);
  voice.cancel();
  assert.equal(await voice.done, 'cancelled');
});

test('five distinct immutable instrument profiles cover every environment and voice family', () => {
  const environmentIds = ['underwater', 'dreamcore', 'space', 'retro', 'cyberpunk'];
  assert.deepEqual(Object.keys(soundProfiles), environmentIds);
  for (const family of ['chords', 'bass', 'melody', 'percussion']) {
    const profiles = environmentIds.map(id => soundProfiles[id][family]);
    assert.equal(new Set(profiles.map(profile => JSON.stringify(profile))).size, 5);
    assert.ok(profiles.every(Object.isFrozen));
  }
  assert.ok(Object.isFrozen(soundProfiles.space.chords.oscillators[0]));
  assert.equal(midiToFrequency(69), 440);
  assert.equal(midiToFrequency(81), 880);
  assert.equal(midiToFrequency(57), 220);
  assert.throws(() => midiToFrequency(69.5), RangeError);
});

test('chord oscillators use MIDI frequency and share a velocity-scaled envelope on the caller output', async () => {
  const graph = rig();
  const voice = play(graph, chord, { duration: 1 });
  const profile = soundProfiles.underwater.chords;
  const [outputGain] = graph.nodes.filter(node => node.connections.includes(graph.output));
  assert.equal(graph.sources.length, 6);
  assert.deepEqual(graph.sources.map(node => node.frequency.value),
    chord.pitches.flatMap(note => [midiToFrequency(note), midiToFrequency(note)]));
  assert.deepEqual(graph.sources.map(node => node.detune.value), [0, 5, 0, 5, 0, 5]);
  assert.ok(graph.sources.every(node => node.starts[0] === 2 && node.stops[0] === voice.endsAt));
  assert.deepEqual(outputGain.gain.calls[0], ['setValueAtTime', 0, 2]);
  assert.deepEqual(outputGain.gain.calls[1], ['linearRampToValueAtTime', profile.gain / 3 * .8, 2 + profile.attack]);
  assert.deepEqual(outputGain.gain.calls.at(-1), ['linearRampToValueAtTime', 0, 3 + profile.release]);
  assert.equal(voice.endsAt, 3 + profile.release);
  assert.ok(graph.nodes.every(node => !node.connections.includes(graph.context.destination)));
  for (const node of graph.sources.slice(0, -1)) node.onended();
  assert.equal(outputGain.disconnects, 0);
  graph.sources.at(-1).onended();
  assert.equal(await voice.done, 'ended');
  assert.ok(graph.nodes.slice(2).every(node => node.disconnects === 1));
  assert.ok(graph.sources.every(node => node.onended === null));
  assert.equal(graph.output.disconnects, 0);
});

test('early release shortens every source once and uses the audio clock with or without hold support', async () => {
  for (const hold of [true, false]) {
    const graph = rig({ hold });
    const voice = play(graph, chord, { duration: 4 });
    const [gain] = graph.nodes.filter(node => node.connections.includes(graph.output));
    const stopAt = 2.1 + soundProfiles.underwater.chords.release;
    graph.context.currentTime = 2.1;
    voice.release();
    voice.release(3);
    assert.equal(voice.endsAt, stopAt);
    assert.ok(graph.sources.every(node => node.stops.length === 2 && node.stops[1] === stopAt));
    assert.deepEqual(gain.gain.calls.find(call => call[0].startsWith('cancel')),
      [hold ? 'cancelAndHoldAtTime' : 'cancelScheduledValues', 2.1]);
    if (!hold) {
      const [, value, time] = gain.gain.calls.at(-2);
      const profile = soundProfiles.underwater.chords;
      assert.ok(Math.abs(value - profile.gain / 3 * .8 * (.1 / profile.attack)) < 1e-10);
      assert.equal(time, 2.1);
    }
    for (const node of graph.sources) node.onended();
    assert.equal(await voice.done, 'released');
  }
});

test('a resumed pad begins at the saved envelope and filter position and uses only its remaining gate', async () => {
  const graph = rig();
  const profile = soundProfiles.underwater.chords;
  const voice = play(graph, chord, { duration: 2, offset: 1.2 });
  const [gain] = graph.nodes.filter(node => node.connections.includes(graph.output));
  const [filter] = graph.nodes.filter(node => node.type === 'lowpass');
  assert.deepEqual(gain.gain.calls[0], ['setValueAtTime', profile.gain / 3 * .8 * profile.sustain, 2]);
  assert.equal(filter.frequency.calls[0][1], profile.cutoff * profile.sweep);
  assert.equal(filter.frequency.calls.length, 1);
  assert.equal(voice.endsAt, 2 + (2 - 1.2) + profile.release);
  assert.throws(() => play(graph, chord, { duration: 2, offset: 2 }), RangeError);
  assert.throws(() => play(graph, hit('kick'), { offset: .01 }), RangeError);
  voice.cancel();
  assert.equal(await voice.done, 'cancelled');
});

test('repeated notes are independent and cancelling a queued note detaches only its own graph', async () => {
  const graph = rig();
  const first = play(graph, bass);
  const firstSource = graph.sources[0];
  const second = play(graph, bass);
  assert.notEqual(first, second);
  first.release();
  first.cancel();
  assert.equal(await first.done, 'cancelled');
  assert.equal(firstSource.stops.at(-1), graph.context.currentTime);
  assert.equal(firstSource.disconnects, 1);
  assert.equal(graph.sources[1].disconnects, 0);
  assert.equal(graph.sources[1].stops.length, 1);
  assert.ok(graph.nodes.some(node => node.type === 'highpass' && node.frequency.value === 26));
  graph.sources[1].onended();
  assert.equal(await second.done, 'ended');
});

test('kick, snare, closed and open hats map to the expected sources and reuse only the noise buffer', async () => {
  const graph = rig();
  const kick = play(graph, hit('kick'));
  const snare = play(graph, hit('snare'));
  const hat = play(graph, hit('hat'));
  const closed = play(graph, hit('closed-hat'));
  const open = play(graph, hit('open-hat'));
  assert.deepEqual(graph.sources.map(node => node.kind), ['oscillator', 'oscillator', 'buffer', 'buffer', 'buffer', 'buffer']);
  assert.equal(graph.buffers.length, 1);
  assert.ok(graph.sources.filter(node => node.kind === 'buffer').every(node => node.buffer === graph.buffers[0]));
  assert.equal(hat.endsAt, closed.endsAt);
  assert.ok(open.endsAt > hat.endsAt);
  const [, [sweep, lowFrequency, endTime]] = graph.sources[0].frequency.calls;
  assert.equal(sweep, 'exponentialRampToValueAtTime');
  assert.ok(lowFrequency < graph.sources[0].frequency.calls[0][1] && endTime > 2);
  const other = rig();
  const otherHat = play(other, hit('hat'));
  assert.notEqual(other.buffers[0], graph.buffers[0]);
  for (const voice of [kick, snare, hat, closed, open, otherHat]) {
    voice.cancel();
    assert.equal(await voice.done, 'cancelled');
  }
});

test('invalid voice inputs fail before allocation and stale starts clamp to audio-clock now', async () => {
  const graph = rig();
  for (const velocity of [-.01, 1.01, NaN, '1']) assert.throws(() => play(graph, { ...bass, velocity }), RangeError);
  for (const duration of [0, -1, NaN, Infinity, 301]) assert.throws(() => play(graph, bass, { duration }), RangeError);
  for (const time of [-1, NaN, Infinity, 1e300]) assert.throws(() => play(graph, bass, { time }), RangeError);
  assert.throws(() => play(graph, hit('cowbell')), RangeError);
  assert.throws(() => play(graph, { ...bass, pitches: [128] }), RangeError);
  assert.throws(() => play(graph, { ...chord, pitches: Array(2) }), RangeError);
  assert.throws(() => play(graph, { ...chord, pitches: Array(9).fill(60) }), RangeError);
  assert.throws(() => play(graph, bass, { environmentId: 'toString' }), RangeError);
  assert.throws(() => play(graph, bass, { output: rig().output }), TypeError);
  assert.throws(() => play(graph, bass, { output: graph.context.destination }), TypeError);
  assert.equal(graph.nodes.length, 2);
  const voice = play(graph, { ...bass, velocity: 0 }, { time: 0, duration: .001 });
  assert.equal(voice.startTime, graph.context.currentTime);
  const [gain] = graph.nodes.filter(node => node.connections.includes(graph.output));
  assert.ok(gain.gain.calls.every(([, value]) => value === 0));
  voice.cancel();
  assert.equal(await voice.done, 'cancelled');
});

test('connection and partial source-start failures roll back all voice-owned nodes', () => {
  const graph = rig({ failConnect: true });
  assert.throws(() => play(graph, chord), /connection failed/);
  assert.ok(graph.nodes.slice(2).every(node => node.disconnects === 1));
  assert.ok(graph.sources.every(node => node.starts.length === 0 && node.onended === null));
  assert.equal(graph.output.disconnects, 0);

  const partial = rig();
  const createOscillator = partial.context.createOscillator;
  partial.context.createOscillator = () => {
    const oscillator = createOscillator();
    if (partial.sources.length === 2) oscillator.start = () => { throw new Error('start failed'); };
    return oscillator;
  };
  assert.throws(() => play(partial, chord), /start failed/);
  assert.equal(partial.sources[0].stops.at(-1), partial.context.currentTime);
  assert.ok(partial.nodes.slice(2).every(node => node.disconnects === 1));
  assert.ok(partial.sources.every(node => node.onended === null));
});

test('every approved score event, including the chord carry, maps to a bounded voice in each palette', async () => {
  for (const environmentId of Object.keys(soundProfiles)) {
    const score = generateComposition({ environmentId, seed: 'instrument-test' });
    const graph = rig();
    const secondsPerTick = 60 / score.tempo / score.ticksPerQuarter;
    for (const event of score.events) {
      const voice = play(graph, event, {
        environmentId, time: 2 + event.startTick * secondsPerTick,
        duration: event.durationTicks * secondsPerTick
      });
      assert.ok(voice.endsAt > voice.startTime);
      if (event.carryTicks) {
        assert.ok(voice.endsAt > 2 + score.loop.endTickExclusive * secondsPerTick);
      }
      voice.cancel();
      await voice.done;
    }
    assert.ok(graph.nodes.slice(2).every(node => node.disconnects === 1));
    assert.ok(graph.sources.every(node => node.starts.length === 1 && node.onended === null));
  }
});
