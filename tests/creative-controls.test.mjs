import test from 'node:test';
import assert from 'node:assert/strict';
import { CreativeControls, controlDefaults, generationSettings, mixSettings } from '../js/create/controls.js';
import { generateComposition } from '../js/composition/planner.js';
import { prepareScore } from '../js/create/score.js';
import { CreateSelection } from '../js/create/selection.js';
import { musicPresets } from '../js/music-presets.js';

test('every environment provides eight normalized defaults and neutral Speed keeps preset tempo', () => {
  for (const [environmentId, defaults] of Object.entries(controlDefaults)) {
    assert.deepEqual(Object.keys(defaults), ['color','chaos','speed','distortion','energy','density','melody','space']);
    assert.ok(Object.values(defaults).every(value => value >= 0 && value <= 100));
    assert.equal(generationSettings(environmentId, defaults).tempo, musicPresets[environmentId].bpm);
    assert.ok(generationSettings(environmentId, { ...defaults, speed: 0 }).tempo < musicPresets[environmentId].bpm);
    assert.ok(generationSettings(environmentId, { ...defaults, speed: 100 }).tempo > musicPresets[environmentId].bpm);
  }
});

test('environment switches and next-generation edits do not change the live mix or current score', () => {
  const controls = new CreativeControls('space');
  const selection = new CreateSelection();
  const current = selection.generate({ environmentId: 'space', seed: 5, ...generationSettings('space', controls.draft) }, controls.capture());
  selection.select();
  const live = { ...controls.activate(current) };
  controls.selectEnvironment('retro');
  controls.set('speed', 100);
  controls.set('density', 0);
  controls.set('chaos', 100);
  assert.deepEqual(controls.live, live);
  const pending = selection.generate({ environmentId: 'retro', seed: 6, ...generationSettings('retro', controls.draft) }, controls.capture());
  assert.equal(selection.select({ resume: true }), current);
  assert.equal(current.tempo, 84);
  assert.equal(pending.tempo, 114);
  controls.set('melody', 0);
  assert.equal(controls.live.melody, 0);
  controls.reset();
  assert.deepEqual(controls.draft, controlDefaults.retro);
  assert.equal(controls.live.melody, 0);
  assert.equal(selection.select(), pending);
  assert.equal(controls.activate(pending).melody, controlDefaults.retro.melody);
});

test('Density and Chaos shape different musical properties without changing the loop or harmony', () => {
  for (const environmentId of Object.keys(controlDefaults)) {
    const options = { environmentId, seed: 42 };
    const sparse = generateComposition({ ...options, density: 0, chaos: 0 });
    const dense = generateComposition({ ...options, density: 100, chaos: 0 });
    const varied = generateComposition({ ...options, density: 100, chaos: 100 });
    assert.deepEqual(varied, generateComposition({ ...options, density: 100, chaos: 100 }));
    assert.ok(dense.events.length > sparse.events.length);
    assert.notDeepEqual(varied.events.filter(event => event.layer === 'melody').map(event => event.pitches),
      dense.events.filter(event => event.layer === 'melody').map(event => event.pitches));
    for (const score of [sparse, dense, varied]) {
      prepareScore(score);
      assert.deepEqual(score.harmony, sparse.harmony);
      assert.deepEqual(score.loop, sparse.loop);
      assert.deepEqual(score.events.filter(event => event.carryTicks), sparse.events.filter(event => event.carryTicks)
        .map(event => ({ ...event, order: score.events.find(item => item.carryTicks).order })));
      for (const event of score.events.filter(event => event.layer === 'melody')) {
        assert.ok(score.tonality.scale.includes((event.pitches[0] - score.tonality.tonicMidi + 120) % 12));
        assert.ok(score.arrangement[Math.floor(event.startTick / 384)].layers.melody.active);
      }
    }
    const base = generateComposition(options);
    const { generation, ...neutral } = generateComposition({ ...options, density: 50, chaos: 50 });
    assert.deepEqual(neutral, base);
  }
});

test('live extremes retain core harmony, bound the saturation blend, and can mute lead only', () => {
  const low = mixSettings({ ...controlDefaults.space, color: 0, energy: 0, melody: 0, distortion: 0, space: 0 });
  const high = mixSettings({ ...controlDefaults.space, color: 100, energy: 100, melody: 100, distortion: 100, space: 100 });
  assert.equal(low.layers.melody, 0);
  assert.ok(low.layers.bass > 0 && low.layers.percussion > 0);
  assert.equal(low.layers.chords, high.layers.chords);
  assert.ok(high.layers.percussion > low.layers.percussion * 3);
  assert.ok(high.layers.melody > 0 && high.layers.melody <= 1.12);
  assert.equal(low.dry, 1);
  assert.equal(low.saturated, 0);
  assert.ok(high.saturated + high.dry <= 1);
  assert.ok(high.brightness > low.brightness && high.drive <= 3);
});
