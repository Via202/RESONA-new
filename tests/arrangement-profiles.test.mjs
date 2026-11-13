import test from 'node:test';
import assert from 'node:assert/strict';
import { generateComposition } from '../js/composition/planner.js';
import { arrangementProfiles } from '../js/composition/arrangement-profiles.js';
import { soundProfiles } from '../js/instruments/index.js';

const ids = ['underwater', 'dreamcore', 'space', 'retro', 'cyberpunk'];
const scores = Object.fromEntries(ids.map(environmentId => [environmentId, generateComposition({ environmentId, seed: 42 })]));
const events = (score, layer, first, last = first) => score.events.filter(event =>
  event.layer === layer && event.startTick >= (first - 1) * score.ticksPerBar &&
  event.startTick < last * score.ticksPerBar
);
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const pitchClasses = notes => new Set(notes.map(note => note.pitches[0] % 12));

test('the five selected arrangement profiles shape actual harmonic pace, bass motion and drum density', () => {
  assert.deepEqual(Object.keys(arrangementProfiles), ids);
  for (const id of ids) {
    assert.equal(scores[id].arrangementProfileId, id);
    assert.ok(Object.hasOwn(soundProfiles, scores[id].environmentId));
  }
  const changes = id => scores[id].harmony.slice(4, 12).filter((chord, index, verse) =>
    index > 0 && chord.rootMidi !== verse[index - 1].rootMidi).length;
  assert.ok(changes('underwater') <= 3 && changes('space') <= 3);
  assert.ok(changes('dreamcore') > changes('underwater') && changes('retro') > changes('space'));
  const bass = id => events(scores[id], 'bass', 5, 12);
  for (const id of ['underwater', 'space']) {
    for (let bar = 5; bar <= 12; bar++) {
      const notes = events(scores[id], 'bass', bar);
      assert.ok(notes.length <= 2);
      const tones = new Set(scores[id].harmony[bar - 1].pitches.map(pitch => pitch % 12));
      assert.ok(notes.every(note => tones.has(note.pitches[0] % 12)));
    }
  }
  assert.ok(pitchClasses(bass('retro')).size > 4);
  assert.ok(bass('cyberpunk').length > bass('retro').length);
  const drums = ['space', 'underwater', 'dreamcore', 'retro', 'cyberpunk']
    .map(id => events(scores[id], 'percussion', 13, 20).length);
  assert.ok(drums.every((count, index) => index === 0 || count > drums[index - 1]));
});

test('phrasing and articulation differ while the established motif returns in the final chorus', () => {
  const durations = id => events(scores[id], 'melody', 13, 20).map(note => note.durationTicks);
  assert.ok(average(durations('space')) > average(durations('underwater')));
  assert.ok(average(durations('underwater')) > average(durations('dreamcore')));
  assert.ok(average(durations('retro')) > average(durations('cyberpunk')));
  assert.ok(durations('cyberpunk').length > durations('underwater').length);
  const retro = scores.retro;
  const offsets = events(retro, 'percussion', 5, 12).map(event => event.startTick % 24);
  assert.ok(offsets.some(offset => offset >= 7 && offset <= 10));
  assert.ok(new Set(offsets.filter(Boolean)).size > 1);
  assert.ok(events(retro, 'chords', 5, 12).every(event => event.durationTicks < 384));
  assert.ok(events(scores.space, 'chords', 5, 12).every(event => event.durationTicks === 384));
  for (const score of Object.values(scores)) {
    const final = events(score, 'melody', 25, 28);
    assert.ok(final.every(note => note.motifId === score.melody.motif.id));
    assert.ok(final.some(note => note.purpose === 'response'));
  }
});

test('every palette has a chorus lift, bridge withdrawal, final peak and coherent loop pulse', () => {
  for (const score of Object.values(scores)) {
    const [intro, verse, chorus, bridge, final, outro] = score.energy.map(section => section.bars.map(bar => bar.level));
    assert.ok(average(chorus) > average(verse));
    assert.ok(average(bridge) < average(chorus));
    assert.ok(Math.max(...final) > Math.max(...chorus));
    assert.equal(intro[0], outro.at(-1));
    assert.equal(score.arrangement[20].layers.percussion.transition, 'exit');
    assert.equal(score.arrangement[22].layers.percussion.transition, 'return');
    assert.equal(score.arrangement[24].layers.bass.transition, 'return');
    assert.deepEqual(events(score, 'percussion', 1).map(({ order, ...hit }) => hit),
      events(score, 'percussion', 32).map(({ order, ...hit }) => ({ ...hit, startTick: hit.startTick - 31 * 384 })));
    const carries = score.events.filter(event => event.carryTicks > 0);
    assert.equal(carries.length, 1);
    assert.equal(carries[0].role, 'loop-common-tone');
    assert.equal(carries[0].startTick + carries[0].durationTicks, score.loop.endTickExclusive + 96);
  }
});

test('seeded profiles repeat exactly and vary the musical plan without changing the seam', () => {
  for (const environmentId of ids) {
    const options = { environmentId, seed: 'arrangement-9', tempo: 96 };
    const reference = generateComposition(options);
    generateComposition({ environmentId: 'retro', seed: 700 });
    assert.equal(JSON.stringify(generateComposition(options)), JSON.stringify(reference));
    const variants = Array.from({ length: 8 }, (_, seed) => generateComposition({ ...options, seed }));
    assert.ok(new Set(variants.map(score => JSON.stringify(score.harmony))).size > 1);
    assert.ok(new Set(variants.map(score => JSON.stringify(score.melody.motif))).size > 1);
    for (const score of variants) {
      assert.deepEqual(score.loop, reference.loop);
      assert.deepEqual(score.sections, reference.sections);
      assert.deepEqual(score.harmony[0], reference.harmony[0]);
      assert.deepEqual(score.harmony.at(-1), reference.harmony.at(-1));
    }
  }
});
