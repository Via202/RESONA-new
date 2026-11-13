import { BAR_COUNT, LOOP_LENGTH, METER, TICKS_PER_BAR, TICKS_PER_QUARTER, compareEvents } from '../composition/score.js';
import { soundProfiles } from '../instruments/index.js';

const midi = value => Number.isInteger(value) && value >= 0 && value <= 127;

function validVoice(event, palette) {
  const { layer, kind, pitches, instrument } = event;
  if (layer === 'percussion') {
    return kind === 'hit' && typeof instrument === 'string' &&
      (instrument === 'closed-hat' || Object.hasOwn(palette.percussion, instrument));
  }
  if (!Array.isArray(pitches) || !Array.from(pitches).every(midi)) return false;
  if (layer === 'chords' && kind === 'chord') return pitches.length >= 1 && pitches.length <= 8;
  return kind === 'note' && pitches.length === 1 && ['chords', 'bass', 'melody'].includes(layer);
}

// Validate before exposing a score to transport or allocating any audio nodes.
export function prepareScore(score) {
  const { tempo, loop, meter, environmentId } = score ?? {};
  if (typeof environmentId !== 'string' || !Object.hasOwn(soundProfiles, environmentId) ||
      !Number.isFinite(tempo) || tempo < 20 || tempo > 400 ||
      score.barCount !== BAR_COUNT || score.ticksPerQuarter !== TICKS_PER_QUARTER ||
      score.ticksPerBar !== TICKS_PER_BAR || meter?.numerator !== METER.numerator ||
      meter.denominator !== METER.denominator || loop?.startTick !== 0 ||
      loop.endTickExclusive !== LOOP_LENGTH || loop.lengthTicks !== LOOP_LENGTH ||
      loop.boundaryPolicy !== 'carry-duration' || !Array.isArray(score.events) ||
      !score.events.length || score.events.length > 4096) {
    throw new RangeError('Unsupported CREATE score or tempo.');
  }
  const secondsPerTick = 60 / tempo / TICKS_PER_QUARTER;
  const orders = new Set();
  let previous;
  const events = Array.from(score.events, event => {
    if (!event || !Number.isInteger(event.order) || event.order < 0 || orders.has(event.order) ||
        !Number.isInteger(event.startTick) || event.startTick < 0 || event.startTick >= LOOP_LENGTH ||
        !Number.isInteger(event.durationTicks) || event.durationTicks < 1 || event.durationTicks > LOOP_LENGTH ||
        event.durationTicks * secondsPerTick > 300 ||
        event.carryTicks !== Math.max(0, event.startTick + event.durationTicks - LOOP_LENGTH) ||
        !Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 1 ||
        (previous && compareEvents(previous, event) > 0) || !validVoice(event, soundProfiles[environmentId])) {
      throw new RangeError('Invalid or unordered CREATE event.');
    }
    orders.add(event.order);
    previous = event;
    const snapshot = Object.freeze({
      ...event, ...(event.pitches && { pitches: Object.freeze([...event.pitches]) })
    });
    return Object.freeze({ event: snapshot, at: event.startTick * secondsPerTick, duration: event.durationTicks * secondsPerTick });
  });
  return Object.freeze({
    environmentId, tempo, seed: score.seed, secondsPerTick,
    cycleSeconds: LOOP_LENGTH * secondsPerTick, events: Object.freeze(events)
  });
}
