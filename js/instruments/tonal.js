import { createVoice, midiToFrequency } from './voice.js';

export function tonalVoice(options, pitches, profile, { highpass = 0, maxPitches = 1 } = {}) {
  if (!Array.isArray(pitches) || !pitches.length || pitches.length > maxPitches) {
    throw new RangeError('Invalid pitch count for instrument.');
  }
  const frequencies = Array.from(pitches, midiToFrequency);
  const { context } = options;
  const envelope = { ...profile, gain: profile.gain / frequencies.length };
  return createVoice({
    ...options, envelope,
    build({ own, source, target, startTime, gateEnd }) {
      const lowpass = own(context.createBiquadFilter());
      lowpass.type = 'lowpass';
      const limit = context.sampleRate * .45;
      lowpass.Q.value = profile.resonance;
      const offset = options.offset ?? 0;
      const sweepTime = Math.min(options.duration, profile.sweepTime);
      const from = Math.min(limit, profile.cutoff);
      const to = Math.min(limit, profile.cutoff * profile.sweep);
      lowpass.frequency.setValueAtTime(from * (to / from) ** Math.min(1, offset / sweepTime), startTime);
      if (offset < sweepTime) {
        lowpass.frequency.exponentialRampToValueAtTime(to, Math.min(gateEnd, startTime + sweepTime - offset));
      }
      if (highpass) {
        const rumble = own(context.createBiquadFilter());
        rumble.type = 'highpass';
        rumble.frequency.value = Math.min(limit, highpass);
        lowpass.connect(rumble);
        rumble.connect(target);
      } else {
        lowpass.connect(target);
      }

      for (const frequency of frequencies) {
        for (const layer of profile.oscillators) {
          const oscillator = source(context.createOscillator());
          oscillator.type = layer.wave;
          oscillator.frequency.value = frequency * layer.ratio;
          oscillator.detune.value = layer.detune;
          const mix = own(context.createGain());
          mix.gain.value = layer.mix;
          oscillator.connect(mix);
          mix.connect(lowpass);
        }
      }
    }
  });
}
