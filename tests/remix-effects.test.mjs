import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../js/audio.js';
import { remixSettings } from '../js/remix-effects.js';
import { remixProfiles } from '../js/remix-profiles.js';

const minimum = { color: 0, distortion: 0, energy: 0, space: 0 };
const maximum = { color: 100, distortion: 100, energy: 100, space: 100 };

function fixture(t) {
  const nodes = [], buffers = [], counts = { context: 0, source: 0, analyser: 0 };
  function node(kind) {
    const links = new Set();
    const param = () => ({
      value: 1,
      setTargetAtTime(value, time, constant) { this.target = { value, time, constant }; }
    });
    const result = {
      kind, links, gain: param(), frequency: param(), Q: param(),
      threshold: param(), ratio: param(), attack: param(), release: param(), knee: param(),
      connect(target) { links.add(target); return target; },
      disconnect(target) { if (target) links.delete(target); else links.clear(); }
    };
    nodes.push(result);
    return result;
  }
  const context = {
    state: 'suspended', currentTime: 4, sampleRate: 48000, destination: node('destination'),
    createMediaElementSource() { counts.source++; return node('source'); },
    createAnalyser() { counts.analyser++; return Object.assign(node('analyser'), { frequencyBinCount: 1024 }); },
    createGain: () => node('gain'),
    createBiquadFilter: () => node('filter'),
    createDynamicsCompressor: () => node('compressor'),
    createWaveShaper: () => node('shaper'),
    createConvolver: () => node('convolver'),
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { getChannelData: index => data[index] };
      buffers.push(buffer);
      return buffer;
    },
    async resume() { this.state = 'running'; }
  };
  const saved = globalThis.window;
  globalThis.window = { AudioContext: class { constructor() { counts.context++; return context; } } };
  t.after(() => { if (saved === undefined) delete globalThis.window; else globalThis.window = saved; });
  const media = {
    currentTime: 17.5, paused: true, plays: 0,
    async play() { this.plays++; this.paused = false; }
  };
  const engine = new AudioEngine(media);
  return { context, media, engine, nodes, buffers, counts, node };
}

test('REMIX inserts exactly one graph and bypass keeps unity gain and playback position', async t => {
  const { context, engine, media, nodes, buffers, counts } = fixture(t);
  engine.setRemix(minimum, false);
  assert.equal(counts.context, 0);
  await engine.start();
  assert.deepEqual(counts, { context: 1, source: 1, analyser: 1 });
  const [input] = engine.source.links;
  assert.deepEqual([...engine.source.links], [engine.remixEffects.input]);
  const [original, processed] = nodes.filter(node => node.kind === 'gain' && node.links.has(engine.analyser));
  assert.ok(input.links.has(original));
  assert.equal(original.gain.value, 1);
  assert.equal(processed.gain.value, 0);
  assert.deepEqual(nodes.filter(node => node.links.has(context.destination)), [engine.analyser]);
  const count = nodes.length;
  for (let i = 0; i < 20; i++) engine.setRemix(maximum, i % 2 === 0, 'cyberpunk');
  assert.equal(nodes.length, count);
  assert.equal(buffers.length, 2);
  assert.equal(media.plays, 1);
  assert.equal(media.currentTime, 17.5);
  const verifyWeights = (dry, wet) => {
    assert.deepEqual(original.gain.target, { value: dry, time: 4, constant: .045 });
    assert.deepEqual(processed.gain.target, { value: wet, time: 4, constant: .045 });
  };
  verifyWeights(1, 0);
  engine.setRemix(maximum, true, 'cyberpunk');
  verifyWeights(0, 1);
  const shelf = nodes.find(node => node.type === 'highshelf');
  assert.equal(shelf.gain.target.value, 9.5);
  const dynamics = nodes.find(node => node.kind === 'compressor');
  assert.equal(dynamics.threshold.target.value, -30);
  assert.equal(dynamics.ratio.target.value, 3.7);
  const [short, long] = nodes.filter(node => node.kind === 'convolver');
  assert.ok(short.buffer.getChannelData(0).length < long.buffer.getChannelData(0).length);
  assert.equal([...short.links][0].gain.target.value, .53);
  assert.equal([...long.links][0].gain.target.value, .47);
  assert.equal([...([...long.links][0].links)][0].gain.target.value, .42);
  const [shape, limiter] = nodes.filter(node => node.kind === 'shaper');
  assert.ok(shape.curve.at(-1) < .63);
  assert.ok(limiter.curve.every(sample => Math.abs(sample) < 1));
  const [drive] = nodes.filter(node => node.links.has(shape));
  const [shaped] = shape.links;
  assert.equal(drive.gain.target.value, 3.6);
  assert.ok(Math.abs(shaped.gain.target.value * drive.gain.target.value - .87) < 1e-12);
  const impulses = [short.buffer, long.buffer];
  engine.setRemix(maximum, false, 'space');
  verifyWeights(1, 0);
  assert.equal(shelf.gain.target.value, 6.5);
  assert.equal([...long.links][0].gain.target.value, 1);
  assert.deepEqual([short.buffer, long.buffer], impulses);
  assert.equal(nodes.length, count);
  assert.equal(media.currentTime, 17.5);
  engine.setRemix(maximum, true, 'space');
  verifyWeights(0, 1);
  engine.clearRemix();
});

test('clearing REMIX releases tails without touching CREATE and reuses media source and impulses', async t => {
  const { engine, nodes, media, buffers, counts, node } = fixture(t);
  engine.setRemix(maximum, true);
  await engine.start();
  const create = node('create-master');
  engine.connectExternal(create);
  for (let run = 0; run < 5; run++) {
    media.paused = true;
    engine.clearRemix();
    engine.clearRemix();
    assert.deepEqual([...engine.source.links], [engine.analyser]);
    assert.deepEqual([...create.links], [engine.analyser]);
    assert.ok(nodes.filter(item => item.kind === 'convolver').every(room => room.buffer === null && !room.links.size));
    await engine.start(() => false);
    assert.equal(engine.remixEffects, null);
    await engine.start();
    assert.equal(nodes.filter(item => item.kind === 'convolver' && item.links.size).length, 2);
    assert.equal(buffers.length, 2);
  }
  assert.deepEqual(counts, { context: 1, source: 1, analyser: 1 });
  engine.clearRemix();
  engine.disconnectExternal(create);
  media.play = async () => { throw new Error('decode failure'); };
  await assert.rejects(engine.start(), /decode failure/);
  assert.equal(engine.remixEffects, null);
  assert.deepEqual([...engine.source.links], [engine.analyser]);
});

test('REMIX settings have neutral endpoints, smooth ranges and finite clamped values', () => {
  const distinct = new Set();
  for (const id of Object.keys(remixProfiles)) {
    const low = remixSettings(minimum, id), high = remixSettings(maximum, id);
    assert.equal(high.shelf - low.shelf, 12);
    assert.equal(low.saturation, 0);
    assert.equal(low.ratio, 1);
    assert.equal(low.wet, 0);
    assert.equal(low.dry, 1);
    assert.ok(high.saturation > .5 && high.wet >= .33 && high.ratio >= 2.4);
    distinct.add(JSON.stringify(remixSettings({ color: 50, distortion: 50, energy: 50, space: 50 }, id)));
    for (const value of [0, 25, 50, 75, 100]) {
      const settings = remixSettings({ color: value, distortion: value, energy: value, space: value }, id);
      assert.ok(Object.values(settings).every(Number.isFinite));
      assert.ok(settings.dry + settings.wet <= 1.28);
      assert.ok(settings.makeup <= 1.13 && settings.ratio <= 3.7);
    }
    assert.deepEqual(remixSettings({ color: NaN, distortion: -100, energy: -5, space: 0 }, id), low);
  }
  assert.equal(distinct.size, 5);
});
