import { createVoice } from './voice.js';

const noiseByContext = new WeakMap();
function noiseBuffer(context) {
  let buffer = noiseByContext.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .37), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let state = 4207849484;
    for (let i = 0; i < samples.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      samples[i] = state / 2147483648 - 1;
    }
    noiseByContext.set(context, buffer);
  }
  return buffer;
}

export function playPercussion(options, instrument, kit) {
  const id = instrument === 'closed-hat' ? 'hat' : instrument;
  if (!Object.hasOwn(kit, id)) throw new RangeError('Unknown percussion identity.');
  const profile = kit[id];
  const { context } = options;
  return createVoice({
    ...options, duration: Math.min(options.duration, profile.gate), envelope: profile,
    build({ own, source, target, startTime, gateEnd }) {
      if (profile.body) {
        const oscillator = source(context.createOscillator());
        oscillator.type = 'sine';
        const [initial, final, sweepTime, mix] = profile.body;
        oscillator.frequency.setValueAtTime(initial, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(final, Math.min(gateEnd, startTime + sweepTime));
        const bodyGain = own(context.createGain());
        bodyGain.gain.value = mix;
        oscillator.connect(bodyGain);
        bodyGain.connect(target);
      }
      if (profile.noise) {
        const noise = source(context.createBufferSource());
        noise.buffer = noiseBuffer(context);
        noise.loop = true;
        const [type, cutoff, resonance, mix] = profile.noise;
        const filter = own(context.createBiquadFilter());
        filter.type = type;
        filter.frequency.value = Math.min(context.sampleRate * .45, cutoff);
        filter.Q.value = resonance;
        const noiseGain = own(context.createGain());
        noiseGain.gain.value = mix;
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(target);
      }
    }
  });
}
