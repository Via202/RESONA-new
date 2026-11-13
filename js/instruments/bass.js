import { tonalVoice } from './tonal.js';

export function playBass(options, pitch, profile) {
  return tonalVoice(options, [pitch], profile, { highpass: 26 });
}
