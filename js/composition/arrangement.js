import { BAR_COUNT, TICKS_PER_BAR, TICKS_PER_QUARTER, barStart, compareEvents, createEvent } from './score.js';

const melodyRoles = {
  intro: 'rest', verse: 'sparse', chorus: 'featured', bridge: 'rest',
  'final-chorus': 'developed', outro: 'withdraw'
};

function layerRoles(sectionId, bar) {
  const seam = bar === 1 || bar === BAR_COUNT;
  const bridge = sectionId === 'bridge';
  const fuller = sectionId === 'chorus' || sectionId === 'final-chorus';
  let percussion = fuller ? 'full' : 'groove';
  if (seam || bar === BAR_COUNT - 1 || bar === 2) percussion = 'loop-pulse';
  if (bridge) percussion = bar <= 22 ? 'withdraw' : 'half-time';
  return {
    chords: 'sustain',
    bass: bridge || bar === BAR_COUNT ? 'withdraw' : seam ? 'rest' : fuller ? 'driving' : 'anchor',
    percussion,
    melody: melodyRoles[sectionId]
  };
}

function describeLayers(rolesByBar) {
  const seenActive = new Set();
  return rolesByBar.map((roles, index) => Object.fromEntries(
    Object.entries(roles).map(([layer, role]) => {
      const active = role !== 'rest' && role !== 'withdraw';
      // Bar one describes the seam from bar 32 during repeat playback.
      const previous = rolesByBar.at(index - 1)[layer];
      const wasActive = previous !== 'rest' && previous !== 'withdraw';
      let transition = active ? 'continue' : 'rest';
      if (active && !wasActive) transition = seenActive.has(layer) ? 'return' : 'enter';
      if (!active && wasActive) transition = 'exit';
      if (active) seenActive.add(layer);
      return [layer, { active, role, transition }];
    })
  ));
}

export function planArrangement(sections, profile, random, breaks = {}) {
  const energy = sections.map(({ id, firstBar, lastBar }, sectionIndex) => ({
    sectionId: id, firstBar, lastBar,
    bars: profile.energy[sectionIndex].map((base, index) => {
      const bar = firstBar + index;
      // Match energy at both sides of the seam.
      const level = bar === 1 || bar === BAR_COUNT ? base : base + (random() - .5) * .04;
      return { bar, level: Math.round(level * 100) / 100 };
    })
  }));
  const bars = energy.flatMap(({ sectionId, bars }) => bars.map(({ bar }) => ({ sectionId, bar })));
  const layersByBar = describeLayers(bars.map(({ sectionId, bar }) => {
    const roles = layerRoles(sectionId, bar);
    if (breaks[bar]) roles[breaks[bar]] = 'withdraw';
    return roles;
  }));
  const arrangement = bars.map(({ sectionId, bar }, index) => ({
    bar, sectionId, startTick: barStart(bar), layers: layersByBar[index]
  }));
  return { energy, arrangement };
}

const pitchClass = note => ((note % 12) + 12) % 12;

function bassPitch(role, chord, nextChord, preset) {
  const root = chord.rootMidi - 24;
  const tones = chord.pitches.map(pitch => pitchClass(pitch - chord.rootMidi));
  if (role === 'root') return root;
  if (role === 'pedal') return tones.includes(pitchClass(preset.tonic - root)) ? preset.tonic - 24 : root;
  if (role === 'approach') {
    const target = nextChord.rootMidi - 24;
    // Use the nearest distinct chord tone in the current bass octave.
    return tones.map(interval => root + interval).reduce((best, pitch) =>
      pitch !== target && (best === target || Math.abs(pitch - target) < Math.abs(best - target)) ? pitch : best, root);
  }
  if (role === 'fifth') return root + ([7, 6, 5].find(interval => tones.includes(interval)) ?? 0);
  if (role === 'color') return root + ([3, 4, 5, 2].find(interval => tones.includes(interval)) ?? 0);
  return root;
}

const drumDurations = { kick: 18, snare: 14, hat: 9, 'open-hat': 22 };

export function planEvents(harmony, energy, arrangement, preset, profile, random, density = 50) {
  const events = [];
  const levels = energy.flatMap(section => section.bars);
  const stepTicks = TICKS_PER_QUARTER / 4;
  const emit = (startTick, durationTicks, data) =>
    events.push(createEvent(events.length, startTick, durationTicks, data));

  for (const [index, chord] of harmony.entries()) {
    const { bar, startTick, pitches } = chord;
    const { chords, bass, percussion } = arrangement[index].layers;
    const { level } = levels[index];
    const seam = bar === 1 || bar === BAR_COUNT;
    const pocket = !seam && profile.pocket ? Math.floor(random() * (profile.pocket + 1)) : 0;
    const onset = step => step * stepTicks + (step % 2 ? Math.round(preset.swing * stepTicks) + pocket : 0);
    const velocity = (base, scale, gain) => Math.round((base + level * scale) * gain * 100) / 100;
    if (chords.active) {
      const gate = profile.chordGates[seam ? 0 : index % 2];
      emit(startTick, gate, { layer: 'chords', kind: 'chord', pitches: [...pitches], velocity: velocity(.34, .38, profile.chordGain) });
    }
    if (bass.active) {
      const nextChord = harmony[(index + 1) % BAR_COUNT];
      for (const [step, note, length] of profile.bass[bass.role]) {
        const offset = onset(step);
        emit(startTick + offset, Math.min(length * stepTicks, TICKS_PER_BAR - offset), {
          layer: 'bass', kind: 'note', pitches: [bassPitch(note, chord, nextChord, preset)],
          velocity: velocity(step === 0 ? .35 : .30, .35, profile.bass.gain)
        });
      }
    }
    if (percussion.active) {
      const emitHit = (instrument, step, gain) => {
        const offset = onset(step);
        const isHat = instrument === 'hat' || instrument === 'open-hat';
        emit(startTick + offset, Math.min(drumDurations[instrument], TICKS_PER_BAR - offset), {
          layer: 'percussion', kind: 'hit', instrument,
          velocity: velocity(isHat ? .18 : .30, isHat ? .22 : .38, profile.drumGain * gain)
        });
      };
      for (const [instrument, steps] of Object.entries(profile.drums[percussion.role])) {
        for (const [index, step] of steps.entries()) {
          if (!seam && density < 40 && instrument === 'hat' && index > 0 &&
              (density < 20 || (bar + index) % 2 === 0)) continue;
          emitHit(instrument, step, step % 4 === 0 ? 1 : .85);
        }
      }
      if (profile.fill && (bar === 20 || bar === 28)) {
        for (const [instrument, steps] of Object.entries(profile.fill)) {
          for (const step of steps) emitHit(instrument, step, .88);
        }
      }
      if (!seam && density > 60 && (percussion.role === 'full' || percussion.role === 'groove') &&
          (density >= 85 || bar % 2 === 0)) {
        const pattern = profile.drums[percussion.role];
        const step = [5, 9, 13].find(candidate => !pattern.hat?.includes(candidate));
        if (step !== undefined) emitHit('hat', step, .58);
      }
    }
    if (bar === BAR_COUNT && chords.active) {
      // Carry the opening chord's fifth in a separate register into the next cycle.
      emit(startTick + 3 * TICKS_PER_QUARTER, 2 * TICKS_PER_QUARTER, {
        layer: 'chords', kind: 'note', role: 'loop-common-tone',
        pitches: [harmony[0].rootMidi - 5], velocity: .28
      });
    }
  }
  return events.sort(compareEvents);
}
