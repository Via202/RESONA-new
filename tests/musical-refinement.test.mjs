import test from 'node:test';
import assert from 'node:assert/strict';
import { generateComposition } from '../js/composition/planner.js';
import { activeChordAt, fitMelody, harmonicGate, pitchClass } from '../js/composition/melodic-harmony.js';

const ids = ['underwater', 'dreamcore', 'space', 'retro', 'cyberpunk'];
const isChordTone = (chord, pitch) => chord.pitches.some(tone => pitchClass(tone - pitch) === 0);

test('Space opens its first lead phrase with the chord and kick on bar five', () => {
  for (const seed of [0, 1, 2, 42, 'space']) {
    const score = generateComposition({ environmentId: 'space', seed });
    const opening = score.events.find(event => event.layer === 'melody');
    assert.equal(opening.startTick, 1536);
    assert.ok(isChordTone(activeChordAt(score.harmony, opening.startTick), opening.pitches[0]));
    assert.ok(score.events.some(event => event.layer === 'chords' && event.startTick === opening.startTick));
    assert.ok(score.events.some(event => event.instrument === 'kick' && event.startTick === opening.startTick));
  }
});

test('Dreamcore and Space hold section destinations without filling inactive bars or losing the pickup', () => {
  for (const environmentId of ['dreamcore', 'space']) {
    for (const seed of [0, 2, 42, 'destination']) {
      const score = generateComposition({ environmentId, seed });
      const melody = score.events.filter(event => event.layer === 'melody');
      assert.deepEqual(score.arrangement.filter(bar => bar.layers.melody.transition === 'exit').map(bar => bar.bar), [21, 29]);
      for (const bar of [12, 20, 28]) {
        const phrase = melody.filter(note => Math.floor(note.startTick / 384) + 1 === bar);
        const destination = phrase.filter(note => note.purpose === 'motif').at(-1);
        const next = phrase.find(note => note.startTick > destination.startTick)?.startTick ?? bar * 384;
        assert.equal(destination.harmonicRole, 'chord-tone');
        assert.equal(destination.startTick + destination.durationTicks, next - 4);
        assert.ok(destination.durationTicks >= 72);
        assert.ok(phrase.every(note => note.purpose !== 'response'));
      }
      assert.equal(melody.at(-1).purpose, 'loop-pickup');
      assert.ok(melody.at(-1).velocity < melody.at(-2).velocity);
      assert.ok(melody.every(note => score.arrangement[Math.floor(note.startTick / 384)].layers.melody.active));
    }
  }
});

test('melody uses the new chord at an in-bar onset and clips only incompatible sustains', () => {
  const first = { startTick: 0, pitches: [60, 64, 67] };
  const second = { startTick: 192, pitches: [62, 65, 67] };
  const harmony = [first, second];
  assert.equal(activeChordAt(harmony, 191), first);
  assert.equal(activeChordAt(harmony, 192), second);
  assert.equal(activeChordAt(harmony, 300), second);
  assert.equal(harmonicGate(harmony, 180, 48, 64), 12);
  assert.equal(harmonicGate(harmony, 180, 48, 67), 48);
  assert.equal(harmonicGate(harmony, 12280, 24, 65), 8);
  assert.equal(harmonicGate(harmony, 12280, 24, 67), 24);
  const slots = [0, 180, 192, 300].map(tick => ({
    tick, duration: 36, target: 64, anchor: true, purpose: 'motif', phraseId: 'a'
  }));
  const notes = fitMelody(slots, [60, 62, 64, 65, 67], harmony, []);
  assert.ok(isChordTone(first, notes[1].pitch));
  assert.ok(isChordTone(second, notes[2].pitch));
});

test('all five melodies use stable phrase endings and only step-resolved internal non-chord notes', () => {
  for (const environmentId of ids) {
    let ornaments = 0;
    for (const seed of [0, 1, 2, 9, 42, 99, 'refine']) {
      const score = generateComposition({ environmentId, seed });
      assert.deepEqual(score, generateComposition({ environmentId, seed }));
      const notes = score.events.filter(note => note.layer === 'melody');
      const inScale = pitch => score.tonality.scale.includes(pitchClass(pitch - score.tonality.tonicMidi));
      for (const [index, note] of notes.entries()) {
        const pitch = note.pitches[0];
        assert.ok(inScale(pitch));
        const before = notes[index - 1], after = notes[index + 1];
        if (before) assert.ok(Math.abs(before.pitches[0] - pitch) <= 8);
        if (note.harmonicRole === 'loop-pickup') {
          assert.ok(Math.abs(notes[0].pitches[0] - pitch) <= 2);
          continue;
        }
        const chord = activeChordAt(score.harmony, note.startTick);
        if (note.harmonicRole === 'chord-tone') {
          assert.ok(isChordTone(chord, pitch));
        } else {
          ornaments++;
          assert.ok(['neighbor', 'passing'].includes(note.harmonicRole));
          assert.ok(!isChordTone(chord, pitch) && note.startTick % 96 !== 0 && note.durationTicks <= 48);
          for (const anchor of [before, after]) {
            assert.equal(anchor.harmonicRole, 'chord-tone');
            assert.equal(anchor.phraseId, note.phraseId);
            assert.ok(Math.abs(anchor.pitches[0] - pitch) <= 2);
          }
          assert.equal(before.pitches[0] === after.pitches[0], note.harmonicRole === 'neighbor');
          for (const bass of score.events.filter(event => event.layer === 'bass' &&
              event.startTick < note.startTick + note.durationTicks && event.startTick + event.durationTicks > note.startTick)) {
            assert.ok(![1, 11].includes(pitchClass(pitch - bass.pitches[0])));
          }
        }
        if (!after || after.phraseId !== note.phraseId) assert.equal(note.harmonicRole, 'chord-tone');
      }
      assert.equal(notes.at(-2).harmonicRole, 'chord-tone');
      assert.equal(notes.at(-1).motifId, notes[0].motifId);
    }
    assert.ok(ornaments > 0, environmentId);
  }
});

test('ambient arrangements avoid snares while Retro and Cyberpunk keep their backbeats', () => {
  for (const environmentId of ids) {
    const score = generateComposition({ environmentId, seed: 42 });
    const drums = score.events.filter(event => event.layer === 'percussion');
    const chorus = drums.filter(event => event.startTick >= 12 * 384 && event.startTick < 20 * 384);
    assert.ok(chorus.length > 0);
    if (['underwater', 'dreamcore', 'space'].includes(environmentId)) {
      assert.ok(drums.every(event => event.instrument !== 'snare'));
      assert.ok(chorus.length <= 41);
      assert.ok(Math.max(...chorus.map(event => event.velocity)) < .7);
    } else {
      for (let bar = 12; bar < 20; bar++) {
        const snares = chorus.filter(event => event.instrument === 'snare' && Math.floor(event.startTick / 384) === bar);
        assert.ok(snares.some(event => event.startTick % 384 === 96));
        assert.ok(snares.some(event => event.startTick % 384 === 288));
      }
    }
    if (environmentId === 'space') {
      assert.equal(chorus.filter(event => event.instrument === 'hat').length, 8);
      assert.ok(chorus.some(event => event.instrument === 'open-hat'));
    }
  }
});
