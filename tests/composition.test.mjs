import test from 'node:test';
import assert from 'node:assert/strict';
import { generateComposition } from '../js/composition/planner.js';
import { barStart, compareEvents, createEvent } from '../js/composition/score.js';
import { environments } from '../js/environments.js';
import { musicPresets } from '../js/music-presets.js';

const environmentIds = ['underwater', 'dreamcore', 'space', 'retro', 'cyberpunk'];
const pitchClass = pitch => pitch % 12;

test('score uses the exact six contiguous sections and 32-bar tick interval', () => {
  const score = generateComposition();
  assert.equal(score.barCount, 32);
  assert.deepEqual(score.meter, { numerator: 4, denominator: 4 });
  assert.equal(score.ticksPerQuarter, 96);
  assert.equal(score.ticksPerBar, 384);
  assert.deepEqual(score.loop, {
    startTick: 0, endTickExclusive: 12288, lengthTicks: 12288, boundaryPolicy: 'carry-duration'
  });
  assert.deepEqual(score.sections.map(({ id, name, firstBar, lastBar }) => [id, name, firstBar, lastBar]), [
    ['intro', 'Intro', 1, 4], ['verse', 'Verse', 5, 12], ['chorus', 'Chorus', 13, 20],
    ['bridge', 'Bridge', 21, 24], ['final-chorus', 'Final Chorus', 25, 28],
    ['outro', 'Outro / Loop Transition', 29, 32]
  ]);
  let nextTick = 0;
  for (const section of score.sections) {
    assert.equal(section.startTick, nextTick);
    assert.equal(section.barCount, section.lastBar - section.firstBar + 1);
    assert.equal(section.startTick, barStart(section.firstBar));
    assert.equal(section.endTickExclusive, barStart(section.lastBar) + 384);
    nextTick = section.endTickExclusive;
  }
  assert.equal(nextTick, score.loop.endTickExclusive);
  for (let bar = 1; bar <= 32; bar++) assert.equal(barStart(bar), 384 * (bar - 1));
  for (const bar of [0, 33, 1.5]) assert.throws(() => barStart(bar), RangeError);
});

test('identical seeds and settings produce byte-identical immutable scores and stable event order', () => {
  const settings = { environmentId: 'retro', seed: 'signal-23', tempo: 103 };
  const first = generateComposition(settings);
  const second = generateComposition(settings);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.tempo, 103);
  assert.equal(first.version, 3);
  assert.ok(Object.isFrozen(first.events[0].pitches));
  assert.ok(Object.isFrozen(first.arrangement[0].layers.bass));
  assert.deepEqual([...first.events].sort(compareEvents), first.events);
  assert.equal(new Set(first.events.map(event => event.order)).size, first.events.length);
});

test('seed changes can alter actual harmonic development while preserving the form and opening', () => {
  for (const environmentId of environmentIds) {
    const scores = Array.from({ length: 12 }, (_, seed) => generateComposition({ environmentId, seed }));
    assert.ok(new Set(scores.map(score => JSON.stringify(score.harmony))).size > 1);
    assert.ok(new Set(scores.map(score => JSON.stringify(score.energy))).size > 1);
    for (const score of scores) {
      assert.deepEqual(score.sections, scores[0].sections);
      assert.deepEqual(score.harmony[0], scores[0].harmony[0]);
      assert.deepEqual(score.harmony.at(-1), scores[0].harmony.at(-1));
      for (const { pitches } of score.harmony) {
        assert.ok(pitches.every((pitch, index) => index === 0 || pitch > pitches[index - 1]));
      }
    }
  }
});

test('all five environment IDs retain their B1 tonal and tempo identities', () => {
  assert.deepEqual(Object.keys(environments).sort(), [...environmentIds].sort());
  for (const environmentId of environmentIds) {
    const score = generateComposition({ environmentId });
    const preset = musicPresets[environmentId];
    assert.equal(score.environmentId, environmentId);
    assert.equal(score.tempo, preset.bpm);
    assert.deepEqual(score.tonality, { name: preset.name, tonicMidi: preset.tonic, scale: preset.scale });
  }
  for (const environmentId of ['unknown', 'toString', ['retro']]) {
    assert.throws(() => generateComposition({ environmentId }), RangeError);
  }
  assert.throws(() => generateComposition({ tempo: Infinity }), RangeError);
  assert.throws(() => generateComposition({ seed: {} }), TypeError);
});

test('harmonies cover every bar and the final suspension shares tonic and fifth with the opening', () => {
  for (const environmentId of environmentIds) {
    const score = generateComposition({ environmentId, seed: 42 });
    assert.equal(score.harmony.length, 32);
    const preset = musicPresets[environmentId];
    for (const [index, chord] of score.harmony.entries()) {
      assert.equal(chord.bar, index + 1);
      assert.equal(chord.startTick, index * 384);
      const section = score.sections.find(section => section.endTickExclusive > chord.startTick);
      assert.equal(chord.sectionId, section.id);
      const expected = chord.presetChordIndex === null ? [0, 5, 7]
        : preset.chords[chord.presetChordIndex][1];
      assert.deepEqual(
        new Set(chord.pitches.map(pitch => pitchClass(pitch + 120 - chord.rootMidi))),
        new Set(expected.map(pitchClass))
      );
    }
    const first = score.harmony[0];
    const final = score.harmony.at(-1);
    assert.equal(final.role, 'tonic-suspension');
    assert.equal(final.rootMidi, first.rootMidi);
    for (const offset of [0, 7]) {
      const common = pitchClass(first.rootMidi + offset);
      assert.ok(first.pitches.map(pitchClass).includes(common));
      assert.ok(final.pitches.map(pitchClass).includes(common));
    }
    const chorus = score.harmony.slice(12, 16);
    const finalChorus = score.harmony.slice(24, 28);
    assert.deepEqual(finalChorus.slice(0, 2).map(chord => chord.pitches), chorus.slice(0, 2).map(chord => chord.pitches));
    assert.notDeepEqual(finalChorus.slice(2).map(chord => chord.pitches), chorus.slice(2).map(chord => chord.pitches));
  }
});

test('section energy and layer coverage create contrast and preserve the groove at the seam', () => {
  const score = generateComposition({ environmentId: 'cyberpunk', seed: 99 });
  assert.equal(score.energy.length, 6);
  assert.equal(score.arrangement.length, 32);
  for (const [index, section] of score.energy.entries()) {
    const boundary = score.sections[index];
    assert.equal(section.sectionId, boundary.id);
    assert.equal(section.bars.length, boundary.barCount);
    for (const [offset, { bar, level }] of section.bars.entries()) {
      assert.equal(bar, boundary.firstBar + offset);
      assert.ok(level > 0 && level <= 1);
      assert.equal(score.arrangement[bar - 1].bar, bar);
      assert.equal(score.arrangement[bar - 1].sectionId, section.sectionId);
      assert.equal(score.arrangement[bar - 1].startTick, barStart(bar));
    }
  }
  const [, verse, chorus, bridge, final, outro] = score.energy.map(section => section.bars.map(bar => bar.level));
  assert.ok(Math.min(...chorus) > Math.max(...verse));
  assert.ok(Math.max(...bridge) < Math.min(...chorus));
  assert.ok(Math.max(...final) > Math.max(...chorus));
  assert.equal(outro.at(-1), score.energy[0].bars[0].level);
  assert.equal(score.arrangement[22].layers.percussion.role, 'half-time');
  assert.equal(score.arrangement[24].layers.melody.role, 'developed');
  const drums = bar => score.events.filter(event => event.layer === 'percussion' &&
    event.startTick >= barStart(bar) && event.startTick < barStart(bar) + 384)
    .map(event => [event.instrument, event.startTick - barStart(bar), event.velocity]);
  assert.ok(drums(1).length > 0);
  assert.deepEqual(drums(1), drums(32));
});

test('layer activity describes planned entrances, withdrawals, returns and the repeating seam', () => {
  const score = generateComposition();
  const layers = bar => score.arrangement[bar - 1].layers;
  for (const [bar, layer, active, role, transition] of [
    [1, 'chords', true, 'sustain', 'continue'],
    [1, 'bass', false, 'rest', 'rest'],
    [2, 'bass', true, 'anchor', 'enter'],
    [5, 'melody', true, 'sparse', 'enter'],
    [13, 'bass', true, 'driving', 'continue'],
    [21, 'bass', false, 'withdraw', 'exit'],
    [21, 'percussion', false, 'withdraw', 'exit'],
    [21, 'melody', false, 'rest', 'exit'],
    [22, 'percussion', false, 'withdraw', 'rest'],
    [23, 'percussion', true, 'half-time', 'return'],
    [25, 'bass', true, 'driving', 'return'],
    [25, 'melody', true, 'developed', 'return'],
    [29, 'melody', false, 'withdraw', 'exit'],
    [31, 'percussion', true, 'loop-pulse', 'continue'],
    [32, 'bass', false, 'withdraw', 'exit']
  ]) {
    const state = layers(bar)[layer];
    assert.deepEqual([state.active, state.role, state.transition], [active, role, transition], `bar ${bar} ${layer}`);
  }
  for (const layer of ['chords', 'bass', 'percussion', 'melody']) {
    assert.equal(layers(32)[layer].active, layers(1)[layer].active);
  }
});

test('every bar has four layer states and event onsets agree with each state across presets', () => {
  for (const environmentId of environmentIds) {
    const score = generateComposition({ environmentId, seed: 42 });
    for (const { startTick, layers } of score.arrangement) {
      assert.deepEqual(Object.keys(layers), ['chords', 'bass', 'percussion', 'melody']);
      const onsets = score.events.filter(event => event.startTick >= startTick && event.startTick < startTick + 384);
      for (const event of onsets) assert.equal(layers[event.layer].active, true);
      for (const [layer, state] of Object.entries(layers)) {
        assert.equal(typeof state.active, 'boolean');
        assert.ok(state.role.length > 0);
        assert.equal(Object.hasOwn(state, 'eventsDeferred'), false);
        const emitted = onsets.some(event => event.layer === layer);
        assert.equal(emitted, state.active);
      }
    }
  }
});

test('event timing is valid and the loop keeps the entire common-tone duration', () => {
  for (const environmentId of environmentIds) {
    const score = generateComposition({ environmentId });
    for (const event of score.events) {
      assert.ok(Number.isInteger(event.startTick) && event.startTick >= 0 && event.startTick < 12288);
      assert.ok(Number.isInteger(event.durationTicks) && event.durationTicks > 0 && event.durationTicks <= 12288);
      assert.equal(event.carryTicks, Math.max(0, event.startTick + event.durationTicks - 12288));
      assert.ok(event.velocity > 0 && event.velocity <= 1);
      if (event.pitches) assert.ok(event.pitches.every(pitch => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127));
    }
    const [tail, ...otherTails] = score.events.filter(event => event.carryTicks > 0);
    assert.equal(otherTails.length, 0);
    assert.equal(tail.role, 'loop-common-tone');
    assert.equal(tail.startTick, 12192);
    assert.equal(tail.durationTicks, 192);
    assert.equal(tail.carryTicks, 96);
    assert.equal(12288 - tail.startTick + tail.carryTicks, tail.durationTicks);
    assert.equal(pitchClass(tail.pitches[0]), pitchClass(score.harmony[0].rootMidi + 7));
    assert.ok(score.events.some(event => event.startTick === 0 && event.kind === 'chord'));
    assert.equal(score.events.filter(event => event.kind === 'chord').length, 32);
    assert.ok(score.events.some(event => event.layer === 'melody'));
  }
  assert.equal(createEvent(0, 12287, 1, {}).carryTicks, 0);
  assert.equal(createEvent(0, 12287, 2, {}).carryTicks, 1);
  for (const [start, duration] of [[12288, 1], [-1, 1], [0, 0], [0, 1.5], [0, 12289]]) {
    assert.throws(() => createEvent(0, start, duration, {}), RangeError);
  }
});
