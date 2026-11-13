import test from 'node:test';
import assert from 'node:assert/strict';
import { generateComposition } from '../js/composition/planner.js';
import { musicPresets } from '../js/music-presets.js';

const environments = Object.keys(musicPresets);
const lead = score => score.events.filter(event => event.layer === 'melody');
const pitchClass = note => ((note % 12) + 12) % 12;
const barOf = event => Math.floor(event.startTick / 384) + 1;
const inBar = (notes, bar) => notes.filter(event => barOf(event) === bar);

test('melody onsets follow the layer plan, scale, chord anchors and nonoverlapping durations in every preset', () => {
  for (const environmentId of environments) {
    for (const seed of [0, 1, 2, 9, 'melody']) {
      const score = generateComposition({ environmentId, seed });
      const notes = lead(score);
      const [low, high] = score.melody.rangeMidi;
      assert.ok(notes.length > 0);
      for (const bar of score.arrangement) {
        const events = inBar(notes, bar.bar);
        assert.equal(events.length > 0, bar.layers.melody.active);
        const chord = score.harmony[bar.bar - 1];
        for (const [index, note] of events.entries()) {
          const [pitch] = note.pitches;
          assert.equal(note.kind, 'note');
          assert.equal(note.pitches.length, 1);
          assert.ok(Number.isInteger(pitch) && pitch >= 0 && pitch <= 127);
          assert.ok(pitch >= low && pitch <= high);
          assert.ok(score.tonality.scale.includes(pitchClass(pitch - score.tonality.tonicMidi)));
          assert.ok(Number.isInteger(note.startTick) && Number.isInteger(note.durationTicks));
          assert.ok(note.startTick >= bar.startTick && note.durationTicks > 0);
          assert.ok(note.startTick + note.durationTicks <= (events[index + 1]?.startTick ?? bar.startTick + 384));
          assert.ok(note.velocity > 0 && note.velocity <= 1);
          if (index === 0 || note.startTick % 96 === 0) {
            assert.ok(chord.pitches.some(tone => pitchClass(tone) === pitchClass(pitch)));
          }
        }
      }
    }
  }
});

test('verse repetitions share the motif rhythm, choruses add a response and the final chorus develops it', () => {
  for (const environmentId of environments) {
    const score = generateComposition({ environmentId, seed: 7 });
    const { motif, phrases } = score.melody;
    const notes = lead(score);
    assert.deepEqual(phrases.map(p => [p.firstBar, p.lastBar, p.form]), [
      [5, 6, 'statement'], [7, 8, 'echo'], [9, 10, 'echo'], [11, 12, 'echo'],
      [13, 14, 'featured'], [15, 16, 'featured'], [17, 18, 'featured'], [19, 20, 'featured'],
      [25, 26, 'developed'], [27, 28, 'developed']
    ]);
    const motifOnsets = bar => inBar(notes, bar).filter(note => note.purpose === 'motif').map(note => note.startTick % 384);
    assert.deepEqual(motifOnsets(5), motifOnsets(7));
    assert.deepEqual(motifOnsets(6), motifOnsets(8));
    assert.deepEqual(motifOnsets(5), motifOnsets(13));
    assert.ok(inBar(notes, 13).some(note => note.purpose === 'response'));
    assert.ok(inBar(notes, 13).length > inBar(notes, 5).length);
    assert.equal(motifOnsets(25)[0], motifOnsets(13)[0]);
    assert.notDeepEqual(motifOnsets(25), motifOnsets(13));
    for (const phrase of phrases) {
      assert.equal(phrase.motifId, motif.id);
      const members = notes.filter(note => note.phraseId === phrase.id);
      assert.ok(members.length > 0);
      assert.ok(members.every(note => note.motifId === motif.id &&
        barOf(note) >= phrase.firstBar && barOf(note) <= phrase.lastBar));
    }
  }
});

test('each preset has a distinct motif rhythm and its melody can vary meaningfully by seed', () => {
  const profiles = new Set();
  for (const environmentId of environments) {
    const scores = Array.from({ length: 10 }, (_, seed) => generateComposition({ environmentId, seed }));
    profiles.add(JSON.stringify(scores[0].melody.motif.cells.map(cell => cell.map(note => note.length))));
    assert.ok(new Set(scores.map(score => JSON.stringify(score.melody.motif))).size > 1);
    assert.ok(new Set(scores.map(score => JSON.stringify(lead(score).map(note => note.pitches)))).size > 1);
  }
  assert.equal(profiles.size, environments.length);
});

test('melody uses an independent stream, stays immutable, and survives a JSON round trip', () => {
  const options = { environmentId: 'retro', seed: 'late-night', tempo: 100 };
  const score = generateComposition(options);
  const json = JSON.stringify(score);
  assert.equal(json, JSON.stringify(generateComposition(options)));
  assert.deepEqual(JSON.parse(json), score);
  assert.ok(Object.isFrozen(score.melody.motif.cells[0][0]));
  assert.ok(Object.isFrozen(score.melody.phrases[0]));
  assert.ok(Object.isFrozen(score.melody.loopReturn.carryEventOrders));
  assert.ok(Object.isFrozen(lead(score)[0].pitches));
  assert.deepEqual(lead(generateComposition({ ...options, tempo: 115 })), lead(score));
});

test('the final melodic pickup points to the next verse without replacing the chord carry', () => {
  for (const environmentId of environments) {
    const score = generateComposition({ environmentId, seed: 99 });
    const notes = lead(score);
    const { pickupOrder, openingOrder, carryEventOrders } = score.melody.loopReturn;
    assert.equal(score.loop.endTickExclusive, 12288);
    const opening = notes[0];
    const pickup = notes.at(-1);
    assert.equal(opening.order, openingOrder);
    assert.equal(pickup.order, pickupOrder);
    assert.equal(barOf(opening), 5);
    assert.equal(barOf(pickup), 28);
    assert.equal(pickup.purpose, 'loop-pickup');
    const interval = Math.abs(opening.pitches[0] - pickup.pitches[0]);
    assert.ok(interval >= 1 && interval <= 2);
    assert.deepEqual(carryEventOrders, notes.filter(note => note.carryTicks).map(note => note.order));
    assert.deepEqual(carryEventOrders, []);
    assert.ok(score.events.some(event => event.role === 'loop-common-tone' && event.carryTicks === 96));
  }
});
