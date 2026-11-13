import { LOOP_LENGTH } from './score.js';

export const pitchClass = note => ((note % 12) + 12) % 12;
const contains = (chord, pitch) => chord.pitches.some(tone => pitchClass(tone - pitch) === 0);

function upperBound(harmony, tick) {
  let low = 0;
  let high = harmony.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (harmony[middle].startTick <= tick) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function activeChordAt(harmony, tick) {
  return harmony[upperBound(harmony, tick) - 1];
}

// A note may ring through a change if its pitch belongs to both harmonies.
export function harmonicGate(harmony, tick, duration, pitch) {
  let cycle = Math.floor(tick / LOOP_LENGTH);
  let index = upperBound(harmony, tick - cycle * LOOP_LENGTH);
  const end = tick + duration;
  while (true) {
    if (index === harmony.length) { index = 0; cycle++; }
    const change = cycle * LOOP_LENGTH + harmony[index].startTick;
    if (change >= end) return duration;
    if (!contains(harmony[index], pitch)) return change - tick;
    index++;
  }
}

function clashesWithBass(slot, pitch) {
  return slot.bass.some(note => {
    const interval = pitchClass(pitch - note);
    return interval === 1 || interval === 11;
  });
}

function voiceCost(slot, pitch) {
  return Math.abs(pitch - slot.target) * .75 + (clashesWithBass(slot, pitch) ? 3 : 0);
}

function movement(from, to, gap) {
  const interval = Math.abs(from - to);
  return interval * (gap > 384 ? .24 : .67) +
    Math.max(0, interval - 5) ** 2 * .85 + (interval === 0 ? .78 : 0);
}

function scaleNeighbors(pitches, pitch) {
  const index = pitches.indexOf(pitch);
  return [pitches[index - 1], pitches[index + 1]].filter(note => note !== undefined);
}

function pickupCost(slot, from, pitch) {
  return movement(from, pitch, 0) + (contains(slot.chord, pitch) ? 0 : 3) +
    (clashesWithBass(slot, pitch) ? 4 : 0);
}

export function fitMelody(slots, pitches, harmony, bassEvents) {
  // First solve the chord-tone skeleton across phrase and chord boundaries.
  const notes = slots.map(slot => ({
    ...slot, chord: activeChordAt(harmony, slot.tick),
    bass: bassEvents.filter(note => note.startTick < slot.tick + slot.duration &&
      note.startTick + note.durationTicks > slot.tick).map(note => note.pitches[0])
  }));
  const opening = notes[0];
  const rows = [];
  for (const [index, slot] of notes.entries()) {
    if (slot.purpose === 'loop-pickup') break;
    const previous = rows.at(-1);
    const gap = index ? slot.tick - notes[index - 1].tick : 0;
    rows.push(pitches.filter(pitch => contains(slot.chord, pitch)).map(pitch => {
      const ownCost = voiceCost(slot, pitch);
      let cost = previous ? Infinity : ownCost;
      let parent;
      for (const candidate of previous ?? []) {
        let nextCost = candidate.cost + ownCost + movement(candidate.pitch, pitch, gap);
        const pickup = notes[index + 1];
        if (pickup?.purpose === 'loop-pickup') {
          nextCost += Math.min(...scaleNeighbors(pitches, candidate.firstPitch).map(note => pickupCost(pickup, pitch, note)));
        }
        if (nextCost < cost) { cost = nextCost; parent = candidate; }
      }
      return { pitch, cost, parent, firstPitch: parent?.firstPitch ?? pitch };
    }));
  }
  let path = rows.at(-1).reduce((best, candidate) => candidate.cost < best.cost ? candidate : best);
  for (let index = rows.length - 1; index >= 0; index--) {
    Object.assign(notes[index], { pitch: path.pitch, harmonicRole: 'chord-tone' });
    path = path.parent;
  }

  // Replace weak internal notes only with a single scalar passing or neighbor step.
  for (let i = 1; i < notes.length - 2; i++) {
    const slot = notes[i], before = notes[i - 1], after = notes[i + 1];
    if (slot.anchor || before.harmonicRole !== 'chord-tone' ||
        before.phraseId !== slot.phraseId || after.phraseId !== slot.phraseId ||
        after.tick - slot.tick > 192 || slot.tick - before.tick > 192) continue;
    const beforeIndex = pitches.indexOf(before.pitch), afterIndex = pitches.indexOf(after.pitch);
    const candidate = pitches.filter((pitch, index) =>
      Math.abs(beforeIndex - index) === 1 && Math.abs(afterIndex - index) === 1 &&
      !contains(slot.chord, pitch) && !clashesWithBass(slot, pitch)
    ).sort((a, b) => voiceCost(slot, a) - voiceCost(slot, b))[0];
    if (candidate === undefined || voiceCost(slot, candidate) > voiceCost(slot, slot.pitch) + .6) continue;
    slot.pitch = candidate;
    slot.harmonicRole = before.pitch === after.pitch ? 'neighbor' : 'passing';
    slot.duration = Math.min(slot.duration, 48);
  }

  const pickup = notes.at(-1);
  if (pickup.purpose === 'loop-pickup') {
    const preceding = notes.at(-2).pitch;
    const options = scaleNeighbors(pitches, opening.pitch);
    pickup.pitch = options.reduce((best, pitch) =>
      pickupCost(pickup, preceding, pitch) < pickupCost(pickup, preceding, best) ? pitch : best);
    pickup.harmonicRole = 'loop-pickup';
  }
  return notes.map(note => ({ ...note, duration: harmonicGate(harmony, note.tick, note.duration, note.pitch) }));
}
