import { tonalVoice } from './tonal.js';

export function playChords(options, pitches, profile) {
  return tonalVoice(options, pitches, profile, { maxPitches: 8 });
}
