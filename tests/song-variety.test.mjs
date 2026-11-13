import test from 'node:test';
import assert from 'node:assert/strict';
import { generateComposition } from '../js/composition/planner.js';
import { compareEvents, LOOP_LENGTH, TICKS_PER_BAR } from '../js/composition/score.js';
import { pitchClass } from '../js/composition/melodic-harmony.js';
import { controlDefaults, generationSettings } from '../js/create/controls.js';
import { prepareScore } from '../js/create/score.js';

const environments = Object.keys(controlDefaults);
const rhythm = (score, layer) => score.events.filter(event => event.layer === layer)
  .map(event => [Math.round(event.startTick / 24), event.instrument]);
const layerActivity = score => score.arrangement.map(bar => Object.values(bar.layers).map(layer => layer.active));
const countDistinct = (scores, feature) => new Set(scores.map(score => JSON.stringify(feature(score)))).size;

test('each world produces different backing rhythms and layer structures at the same controls', () => {
  for (const environmentId of environments) {
    const settings = generationSettings(environmentId, controlDefaults[environmentId]);
    const scores = Array.from({ length: 50 }, (_, seed) => generateComposition({ environmentId, seed, ...settings }));
    assert.equal(countDistinct(scores, layerActivity), 3, environmentId);
    for (const layer of ['bass', 'percussion']) {
      assert.ok(countDistinct(scores, score => rhythm(score, layer)) >= 6, environmentId);
      const chorusBar = 12 * TICKS_PER_BAR / 24;
      const families = countDistinct(scores, score => rhythm(score, layer)
        .filter(([step]) => step >= chorusBar && step < chorusBar + 16));
      assert.equal(families, 3, `${environmentId} ${layer} chorus cells`);
    }
    assert.ok(countDistinct(scores, score => score.harmony.map(chord => chord.presetChordIndex)) > 20, environmentId);
    assert.ok(countDistinct(scores, score => score.events.length) > 1, environmentId);
  }
});

test('5,000 seeds preserve valid backing, melody, layer states and the seam', () => {
  for (const environmentId of environments) {
    const defaults = controlDefaults[environmentId];
    for (let seed = 0; seed < 1000; seed++) {
      const controls = [
        defaults, { ...defaults, density: 0, chaos: 0, speed: 0 },
        { ...defaults, density: 100, chaos: 100, speed: 100 }
      ][seed % 3];
      const options = { environmentId, seed, ...generationSettings(environmentId, controls) };
      const score = generateComposition(options);
      prepareScore(score);
      if (seed % 100 === 0) assert.deepEqual(score, generateComposition(options));
      assert.ok(Object.isFrozen(score.events));
      assert.equal(score.barCount, 32);
      assert.equal(score.loop.endTickExclusive, LOOP_LENGTH);
      const carry = score.events.filter(event => event.carryTicks);
      assert.equal(carry.length, 1);
      assert.equal(carry[0].role, 'loop-common-tone');
      assert.equal(carry[0].carryTicks, 96);
      const byBar = Array.from({ length: 32 }, () => []);
      const drums = new Set();
      let previous, previousMelody;
      let bassEnd = 0;
      for (const event of score.events) {
        const bar = Math.floor(event.startTick / TICKS_PER_BAR);
        byBar[bar].push(event);
        if (previous) assert.ok(compareEvents(previous, event) < 0);
        previous = event;
        const harmony = score.harmony[bar];
        const isChordTone = pitch => harmony.pitches.some(tone => pitchClass(tone - pitch) === 0);
        if (event.layer === 'bass' || event.harmonicRole === 'chord-tone') {
          assert.ok(isChordTone(event.pitches[0]), `${environmentId} ${seed} ${event.layer}`);
        }
        if (event.layer === 'bass' || event.layer === 'percussion') {
          assert.ok(event.startTick + event.durationTicks <= (bar + 1) * TICKS_PER_BAR);
        }
        if (event.layer === 'bass') {
          assert.ok(event.startTick >= bassEnd);
          bassEnd = event.startTick + event.durationTicks;
        }
        if (event.layer === 'percussion') {
          const key = `${event.startTick}/${event.instrument}`;
          assert.ok(!drums.has(key), `${environmentId} ${seed} ${key}`);
          drums.add(key);
          if (['underwater', 'dreamcore', 'space'].includes(environmentId)) assert.notEqual(event.instrument, 'snare');
        }
        if (event.layer === 'melody') {
          const [low, high] = score.melody.rangeMidi;
          assert.ok(event.pitches[0] >= low && event.pitches[0] <= high);
          assert.ok(score.tonality.scale.includes(pitchClass(event.pitches[0] - score.tonality.tonicMidi)));
          if (previousMelody) assert.ok(Math.abs(event.pitches[0] - previousMelody.pitches[0]) <= 8);
          previousMelody = event;
        }
      }
      const activeBefore = new Set();
      for (const [index, bar] of score.arrangement.entries()) {
        for (const [layer, state] of Object.entries(bar.layers)) {
          assert.equal(state.active, byBar[index].some(event => event.layer === layer));
          const wasActive = score.arrangement.at(index - 1).layers[layer].active;
          const expected = state.active
            ? wasActive ? 'continue' : activeBefore.has(layer) ? 'return' : 'enter'
            : wasActive ? 'exit' : 'rest';
          assert.equal(state.transition, expected);
          if (state.active) activeBefore.add(layer);
        }
      }
      const loopPulse = (index) => byBar[index].filter(event => event.layer === 'percussion')
        .map(event => [event.startTick % TICKS_PER_BAR, event.instrument]);
      assert.deepEqual(loopPulse(0), loopPulse(31));
    }
  }
});
