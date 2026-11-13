import { TICKS_PER_BAR, TICKS_PER_QUARTER, createEvent } from './score.js';
import { fitMelody, pitchClass } from './melodic-harmony.js';

const STEP = TICKS_PER_QUARTER / 4;

// Each cell lists sixteenth-note onsets and nominal lengths for one bar.
const profiles = {
  underwater: {
    range: [65, 79], cells: [[[0, 4], [8, 5]], [[2, 5], [10, 4]]], response: [14, 1],
    contours: [[0, 2, 1, -1], [0, -1, 0, 2], [0, 1, 3, 1]], accent: -.04
  },
  dreamcore: {
    range: [69, 86], cells: [[[1, 2], [5, 3], [10, 3]], [[0, 3], [7, 3], [12, 2]]], response: [14, 1],
    contours: [[0, 3, 2, 1, 4, 2], [0, -2, 1, 3, 1, -1], [0, 2, 4, 2, -1, 1]], accent: -.02
  },
  space: {
    range: [64, 81], cells: [[[0, 6], [8, 6]], [[0, 7], [10, 5]]], response: [15, 1],
    contours: [[0, 3, 2, 4], [0, 2, 4, 2], [0, -2, 1, 4]], accent: 0
  },
  retro: {
    range: [64, 80], cells: [[[0, 2], [3, 2], [9, 3]], [[2, 2], [7, 2], [11, 2]]], response: [14, 1],
    contours: [[0, 2, 1, -1, 1, 0], [0, -1, 1, 2, 0, -2], [0, 3, 2, 0, 2, 1]], accent: .02
  },
  cyberpunk: {
    range: [63, 80], cells: [[[0, 2], [3, 1], [8, 2], [11, 1]], [[0, 2], [4, 1], [7, 1], [12, 2]]], response: [14, 1],
    contours: [[0, 1, -2, 2, 0, 3, 1, -1], [0, -2, 1, -1, 2, -2, 0, 1], [0, 3, 1, -2, 0, 2, -1, 1]], accent: .08
  }
};

const choose = (items, random) => items[Math.floor(random() * items.length)];

function motifCell(motif, profile, cellIndex, form, isClosingBar) {
  const cell = motif.cells[cellIndex];
  const notes = cell.map(({ step, length, degreeOffset }, index) => ({
    step: form === 'developed' && index === 1 ? step + 1 : step,
    length,
    degreeOffset: degreeOffset + (form === 'developed' && index > 0 ? 1 : 0),
    purpose: 'motif'
  }));
  if (isClosingBar) {
    notes.push({ step: 15, length: 1, degreeOffset: 0, purpose: 'loop-pickup' });
  } else if (form !== 'statement' && form !== 'echo') {
    const [step, length] = profile.response;
    notes.push({ step, length, degreeOffset: cell.at(-1).degreeOffset - 1, purpose: 'response' });
  }
  return notes;
}

export function composeMelody({ environmentId, preset, harmony, energy, arrangement, articulation, random,
  firstOrder, bassEvents = [], density = 50, chaos = 50 }) {
  const profile = profiles[environmentId];
  const [low, high] = profile.range;
  const scale = new Set(preset.scale);
  const pitches = Array.from({ length: high - low + 1 }, (_, i) => low + i)
    .filter(note => scale.has(pitchClass(note - preset.tonic)));
  const seededContour = choose(profile.contours, random);
  const contour = chaos < 25 ? profile.contours[0] : seededContour;
  const center = Math.floor(pitches.length / 2) - 2 + Math.floor(random() * 3);
  // Keep the broad themes steady. Groove-led profiles can displace one inner note.
  const displaced = random() < .5;
  const delayed = chaos >= 25 && displaced && (environmentId === 'retro' || environmentId === 'cyberpunk');
  const hasBroadEnding = environmentId === 'space' || environmentId === 'dreamcore';
  let offset = 0;
  const motif = {
    id: 'lead-a', lengthBars: 2, registerMidi: pitches[center],
    cells: profile.cells.map(cell => cell.map(([step, length], index) => ({
      step: step + (delayed && index === 1 ? 1 : 0), length, degreeOffset: contour[offset++]
    })))
  };
  const phrases = [];
  const slots = [];
  const levels = energy.flatMap(section => section.bars);
  const activeBars = arrangement.filter(bar => bar.layers.melody.active);
  const lastBar = activeBars.at(-1).bar;

  for (const bar of activeBars) {
    const { role } = bar.layers.melody;
    const previousPhrase = phrases.at(-1);
    const continuesPhrase = previousPhrase?.firstBar === bar.bar - 1 &&
      previousPhrase.sectionId === bar.sectionId;
    const cellIndex = Number(continuesPhrase);
    if (cellIndex === 0) {
      const form = role === 'developed' ? 'developed' : role === 'featured' ? 'featured' :
        phrases.length === 0 ? 'statement' : 'echo';
      phrases.push({
        id: 'phrase-' + (phrases.length + 1), motifId: motif.id,
        sectionId: bar.sectionId, firstBar: bar.bar, lastBar: bar.bar, form
      });
    }
    const phrase = phrases.at(-1);
    phrase.lastBar = bar.bar;
    const level = levels[bar.bar - 1].level;
    const notes = motifCell(motif, profile, cellIndex, phrase.form, bar.bar === lastBar);
    const endsSection = arrangement[bar.bar]?.sectionId !== bar.sectionId;
    if (hasBroadEnding && endsSection && notes.at(-1).purpose === 'response') notes.pop();
    if (density < 40 && notes.at(-1).purpose === 'response' && (density < 20 || bar.bar % 2 === 0)) notes.pop();
    if (density < 20 && notes.length > 2 && !endsSection && notes[1].step % 4 !== 0) notes.splice(1, 1);
    const endingIndex = hasBroadEnding && endsSection ?
      notes.findLastIndex(note => note.purpose === 'motif') : -1;
    // Leave room for the destination to ring ahead of the existing late response.
    if (endingIndex >= 0 && notes[endingIndex].step >= 11) notes[endingIndex].step -= 1;
    const onset = step => step * STEP + (step % 2 ? Math.round(STEP * preset.swing) : 0);

    for (const [index, note] of notes.entries()) {
      const tick = onset(note.step);
      const destination = index === endingIndex;
      const pickup = note.purpose === 'loop-pickup';
      const anchor = !pickup && (destination || index === 0 || tick % TICKS_PER_QUARTER === 0 ||
        (cellIndex === 1 && index === notes.length - 1));
      const lift = role === 'developed' ? articulation.finalLift : role === 'featured' ? articulation.featuredLift : 0;
      const rise = destination ? (environmentId === 'space' ? 4 : 3) : 0;
      const development = chaos > 65 && index > 0 && !pickup &&
        (role === 'developed' || (role === 'featured' && phrase.firstBar % 4 === 3)) ?
        (cellIndex ? -1 : 1) * (chaos >= 90 ? 2 : 1) : 0;
      const motifTarget = pitches[Math.max(0, Math.min(pitches.length - 1,
        center + note.degreeOffset + lift + rise + development))];
      const preparesPickup = bar.bar === lastBar && index === notes.length - 2;
      const target = preparesPickup && !destination ? (motifTarget + slots[0].target * 2) / 3 : motifTarget;
      const next = index + 1 < notes.length ? onset(notes[index + 1].step) : TICKS_PER_BAR;
      const duration = destination ? next - tick - 4 :
        Math.min(Math.round(note.length * STEP * articulation.gate), next - tick - 4);
      const emphasis = pickup ? -.09 : destination ? .10 : anchor ? .07 : 0;
      const velocity = Math.round((.38 + level * .36 + profile.accent + emphasis) * articulation.gain * 100) / 100;
      slots.push({ tick: bar.startTick + tick, duration, target, anchor, velocity,
        phraseId: phrase.id, purpose: note.purpose });
    }
  }
  const events = fitMelody(slots, pitches, harmony, bassEvents).map((note, index) =>
    createEvent(firstOrder + index, note.tick, note.duration, {
      layer: 'melody', kind: 'note', pitches: [note.pitch], velocity: note.velocity,
      motifId: motif.id, phraseId: note.phraseId, purpose: note.purpose, harmonicRole: note.harmonicRole
    }));
  return {
    events,
    melody: {
      profileId: environmentId, rangeMidi: [...profile.range], motif, phrases,
      loopReturn: {
        pickupOrder: events.at(-1).order, openingOrder: events[0].order,
        carryEventOrders: events.filter(event => event.carryTicks > 0).map(event => event.order)
      }
    }
  };
}
