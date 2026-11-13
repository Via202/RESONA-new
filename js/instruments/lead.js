import { tonalVoice } from './tonal.js';

export function playLead(options, pitch, profile) {
  return tonalVoice(options, [pitch], profile);
}
