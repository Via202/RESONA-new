import test from 'node:test';
import assert from 'node:assert/strict';
import { createAmbience, spaceSettings } from '../js/create/ambience.js';

const environments = ['underwater', 'dreamcore', 'space', 'retro', 'cyberpunk'];

function rig(sampleRate = 48000) {
  const context = { sampleRate, currentTime: 0 };
  const nodes = [], reverbs = [], buffers = [];
  function param(initial = 0) {
    let value = initial, transition;
    const current = () => transition ? transition.target + (transition.start - transition.target) *
      Math.exp(-(context.currentTime - transition.time) / transition.constant) : value;
    return {
      get value() { return current(); },
      set value(next) { value = next; transition = null; },
      get transition() { return transition; },
      setTargetAtTime(target, time, constant) {
        transition = { start: current(), target, time, constant };
      }
    };
  }
  function node() {
    const result = { links: new Set(), connect(to) { this.links.add(to); }, disconnect() { this.links.clear(); } };
    nodes.push(result);
    return result;
  }
  context.createGain = () => Object.assign(node(), { gain: param(1) });
  context.createBiquadFilter = () => Object.assign(node(), { frequency: param(), Q: param() });
  context.createConvolver = () => { const reverb = node(); reverbs.push(reverb); return reverb; };
  context.createBuffer = (channels, length) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    const buffer = { getChannelData: index => data[index], length, duration: length / sampleRate };
    buffers.push(buffer);
    return buffer;
  };
  const output = node();
  const room = id => createAmbience(context, id, output, true);
  return { context, nodes, reverbs, buffers, output, room };
}

const energy = samples => samples.reduce((sum, value) => sum + value * value, 0);

test('Space progresses from dry through five distinct room settings in every environment', () => {
  for (const id of environments) {
    const values = [0, .25, .5, .75, 1].map(depth => spaceSettings(id, depth));
    assert.equal(values[0].wet, 0);
    assert.equal(values[0].dry, 1);
    assert.equal(values.at(-1).short, 0);
    assert.equal(values.at(-1).long, 1);
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      assert.ok(Math.abs(value.short + value.long - 1) < 1e-12);
      assert.ok(value.wet <= 1 && value.dry >= .82 && value.dry <= 1);
      if (i) {
        assert.ok(value.wet > values[i - 1].wet);
        assert.ok(value.long > values[i - 1].long);
      }
    }
    assert.deepEqual(spaceSettings(id, -1), values[0]);
    assert.deepEqual(spaceSettings(id, NaN), values[0]);
    assert.deepEqual(spaceSettings(id, 2), values.at(-1));
  }
});

test('two stereo rooms have stable energy, distinct profiles, and substantially different decay', () => {
  for (const rate of [8000, 44100, 48000]) {
    const { room, reverbs } = rig(rate);
    const durations = [];
    for (const id of environments) {
      const bus = room(id);
      const [short, long] = reverbs.slice(-2).map(node => node.buffer);
      durations.push([short.duration, long.duration]);
      assert.ok(long.duration > short.duration * 4);
      for (const buffer of [short, long]) {
        const a = buffer.getChannelData(0), b = buffer.getChannelData(1);
        assert.ok(a.every(Number.isFinite));
        assert.ok(a.slice(0, Math.round(.01 * rate)).every(value => value === 0));
        assert.notDeepEqual(a, b);
        assert.ok(Math.abs(energy(a) - .95 ** 2) < 1e-6);
        assert.ok(Math.abs(energy(b) - .95 ** 2) < 1e-6);
        assert.ok(Math.abs(a.at(-1)) < 1e-5);
      }
      assert.ok(energy(long.getChannelData(0).subarray(rate)) > .1);
      assert.ok(energy(short.getChannelData(0).subarray(rate)) < 1e-10);
      bus.dispose();
    }
    assert.equal(new Set(durations.map(value => value.join('/'))).size, 5);
    assert.ok(durations[2][1] > Math.max(...durations.filter((_, i) => i !== 2).map(value => value[1])));
  }
});

test('live sweeps remain continuous, reuse both convolvers, and keep total path weight at unity', () => {
  const { room, nodes, reverbs, buffers, context } = rig();
  const bus = room('retro');
  bus.setDepth(0, true);
  const weights = reverbs.map(node => [...node.links][0]);
  const wet = [...weights[0].links][0];
  const direct = [...bus.input('chords').links][0];
  const counts = [nodes.length, buffers.length];
  for (const depth of [1, .25, .75, .5, 0, 1, 0]) {
    const params = [direct.gain, wet.gain, ...weights.map(node => node.gain)];
    const before = params.map(param => param.value);
    bus.setDepth(depth);
    assert.ok(params.every((param, index) => Math.abs(param.value - before[index]) < 1e-12));
    assert.ok(params.every(param => param.transition.constant === .08));
    context.currentTime += .03;
    assert.ok(Math.abs(weights[0].gain.value + weights[1].gain.value - 1) < 1e-12);
    assert.ok(wet.gain.value >= 0 && wet.gain.value <= .84);
  }
  context.currentTime += 2;
  assert.ok(wet.gain.value < 1e-10);
  assert.deepEqual([nodes.length, buffers.length], counts);
  bus.dispose();
});

test('sends protect bass and percussion and the wet return only reaches the owned mix', () => {
  const { room, output, reverbs, nodes } = rig();
  const bus = room('space');
  bus.setDepth(1, true);
  const sends = {};
  for (const layer of ['chords', 'bass', 'percussion', 'melody']) {
    const [direct, send] = bus.input(layer).links;
    assert.deepEqual([...direct.links], [output]);
    sends[layer] = send.gain.value;
    const high = [...send.links][0], low = [...high.links][0];
    assert.equal(high.type, 'highpass');
    assert.ok(high.frequency.value >= 220);
    assert.equal(low.type, 'lowpass');
    assert.deepEqual([...low.links], reverbs);
  }
  assert.ok(sends.bass < sends.chords / 10);
  assert.ok(sends.percussion < sends.melody / 4);
  assert.ok(sends.melody <= .66 && sends.chords <= .62);
  const wet = [...[...reverbs[0].links][0].links][0];
  assert.deepEqual([...wet.links], [output]);
  assert.equal(wet.gain.value, 1);
  bus.dispose();
  bus.dispose();
  assert.ok(nodes.every(node => !node.links.size));
  assert.ok(reverbs.every(node => node.buffer === null));
});

test('impulses are deterministic and reused across sessions with no stale graph connections', () => {
  const first = rig(), second = rig();
  for (const id of environments) {
    const bus = first.room(id), other = second.room(id);
    const cached = first.reverbs.slice(-2).map(node => node.buffer);
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(cached[i].getChannelData(0), second.reverbs.slice(-2)[i].buffer.getChannelData(0));
    }
    bus.dispose(); other.dispose();
    const count = first.buffers.length;
    const resumed = first.room(id);
    assert.equal(first.buffers.length, count);
    assert.deepEqual(first.reverbs.slice(-2).map(node => node.buffer), cached);
    resumed.dispose();
  }
  assert.equal(first.buffers.length, 10);
  assert.ok(first.nodes.every(node => !node.links.size));
});
