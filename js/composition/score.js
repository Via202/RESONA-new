export const TICKS_PER_QUARTER = 96;
export const METER = Object.freeze({ numerator: 4, denominator: 4 });
export const TICKS_PER_BAR = METER.numerator * TICKS_PER_QUARTER;
export const BAR_COUNT = 32;
export const LOOP_LENGTH = BAR_COUNT * TICKS_PER_BAR;

const sectionLayout = [
  ['intro', 'Intro', 4],
  ['verse', 'Verse', 8],
  ['chorus', 'Chorus', 8],
  ['bridge', 'Bridge', 4],
  ['final-chorus', 'Final Chorus', 4],
  ['outro', 'Outro / Loop Transition', 4]
];

export function barStart(bar) {
  if (!Number.isInteger(bar) || bar < 1 || bar > BAR_COUNT) {
    throw new RangeError('Expected a bar number from 1 to 32.');
  }
  return (bar - 1) * TICKS_PER_BAR;
}

export function buildSections() {
  let firstBar = 1;
  return sectionLayout.map(([id, name, barCount]) => {
    const startTick = barStart(firstBar);
    const section = {
      id, name, firstBar, lastBar: firstBar + barCount - 1, barCount,
      startTick, endTickExclusive: startTick + barCount * TICKS_PER_BAR
    };
    firstBar += barCount;
    return section;
  });
}

export function compareEvents(a, b) {
  return a.startTick - b.startTick || a.order - b.order;
}

// An onset belongs to one cycle. Its duration remains intact even beyond that cycle.
export function createEvent(order, startTick, durationTicks, musicalData) {
  if (!Number.isInteger(startTick) || startTick < 0 || startTick >= LOOP_LENGTH ||
      !Number.isInteger(durationTicks) || durationTicks < 1 || durationTicks > LOOP_LENGTH) {
    throw new RangeError('Expected an onset inside the loop and a positive integer duration of at most one cycle.');
  }
  return {
    ...musicalData, order, startTick, durationTicks,
    carryTicks: Math.max(0, startTick + durationTicks - LOOP_LENGTH)
  };
}

export function freezeScore(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeScore);
    Object.freeze(value);
  }
  return value;
}
