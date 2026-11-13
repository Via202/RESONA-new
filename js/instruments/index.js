import { soundProfiles } from './profiles.js';
import { playChords } from './chords.js';
import { playBass } from './bass.js';
import { playLead } from './lead.js';
import { playPercussion } from './percussion.js';
import { validateVoice } from './voice.js';

export { soundProfiles } from './profiles.js';
export { midiToFrequency } from './voice.js';

// The caller converts the score's ticks to audio-clock seconds and owns the output bus.
export function scheduleInstrumentEvent({ context, output, environmentId, event, time, duration, offset = 0 }) {
  if (typeof environmentId !== 'string' || !Object.hasOwn(soundProfiles, environmentId)) {
    throw new RangeError('Unknown instrument environment.');
  }
  if (!event || typeof event !== 'object') throw new TypeError('Expected a musical event.');
  const { layer, kind, pitches, instrument, velocity } = event;
  validateVoice(context, output, time, duration, velocity);
  if (!Number.isFinite(offset) || offset < 0 || offset >= duration || (offset > 0 && layer === 'percussion')) {
    throw new RangeError('Expected a tonal offset inside the note gate.');
  }
  const options = { context, output, time, duration, velocity, offset };
  const palette = soundProfiles[environmentId];

  if (layer === 'percussion' && kind === 'hit' && typeof instrument === 'string') {
    return playPercussion(options, instrument, palette.percussion);
  }
  if (layer === 'chords' && (kind === 'chord' || (kind === 'note' && pitches?.length === 1))) {
    return playChords(options, pitches, palette.chords);
  }
  if (kind === 'note' && Array.isArray(pitches) && pitches.length === 1) {
    if (layer === 'bass') return playBass(options, pitches[0], palette.bass);
    if (layer === 'melody') return playLead(options, pitches[0], palette.melody);
  }
  throw new RangeError('Unsupported instrument event.');
}
