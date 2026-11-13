const space = Object.freeze({
  seconds: 3.2, preDelay: .027, highpass: 220, lowpass: 4700, wet: .72,
  sends: Object.freeze({ chords: .56, melody: .5, bass: .045, percussion: .13 })
});
const impulses = new WeakMap();

const controlledRooms = Object.freeze({
  underwater: { short: .65, long: 3.8, preDelay: .018, highpass: 220, lowpass: 3400, wet: .86, reflections: .08 },
  dreamcore: { short: .85, long: 4.8, preDelay: .023, highpass: 220, lowpass: 4200, wet: .95, reflections: .06 },
  space: { short: 1, long: 6.4, preDelay: .032, highpass: 220, lowpass: 4700, wet: 1, reflections: .08 },
  retro: { short: .38, long: 3, preDelay: .012, highpass: 240, lowpass: 3900, wet: .84, reflections: .22 },
  cyberpunk: { short: .42, long: 3.6, preDelay: .016, highpass: 260, lowpass: 5100, wet: .90, reflections: .30 }
});
const controlledSends = Object.freeze({ chords: .62, melody: .66, bass: .025, percussion: .12 });

// Linear path weights share a time constant, so their sum stays at unity during
// live changes. A separate wet gain keeps zero fully dry without buffer swaps.
export function spaceSettings(environmentId, depth) {
  const amount = Number.isFinite(depth) ? Math.max(0, Math.min(1, depth)) : 0;
  const blend = amount ** 1.6;
  return {
    dry: 1 - .18 * amount,
    wet: controlledRooms[environmentId].wet * amount ** 1.1,
    short: 1 - blend,
    long: blend
  };
}

export function createAmbience(context, environmentId, mix, controlled = false) {
  if (controlled) return createControlledAmbience(context, environmentId, mix);
  if (environmentId !== 'space') return null;
  const profile = space;
  const nodes = [];
  const own = node => { nodes.push(node); return node; };
  const dispose = () => {
    for (const node of nodes) node.disconnect();
    nodes.length = 0;
  };
  try {
    const high = own(context.createBiquadFilter());
    high.type = 'highpass';
    high.frequency.value = profile.highpass;
    high.Q.value = .707;
    const low = own(context.createBiquadFilter());
    low.type = 'lowpass';
    low.frequency.value = Math.min(profile.lowpass, context.sampleRate * .45);
    low.Q.value = .707;
    const reverb = own(context.createConvolver());
    reverb.normalize = true;
    reverb.buffer = impulseFor(context, environmentId, profile);
    const wet = own(context.createGain());
    wet.gain.value = profile.wet;
    high.connect(low);
    low.connect(reverb);
    reverb.connect(wet);
    wet.connect(mix);

    const inputs = new Map();
    for (const [layer, amount] of Object.entries(profile.sends)) {
      const input = own(context.createGain());
      const send = own(context.createGain());
      send.gain.value = amount;
      input.connect(mix);
      input.connect(send);
      send.connect(high);
      inputs.set(layer, input);
    }
    return {
      input: layer => inputs.get(layer) ?? mix,
      setDepth(depth, initialize) {
        const amount = Math.max(0, Math.min(1, depth));
        const value = profile.wet * amount;
        if (initialize) wet.gain.value = value;
        else wet.gain.setTargetAtTime(value, context.currentTime, .025);
      },
      dispose() {
        dispose();
        inputs.clear();
        reverb.buffer = null;
      }
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

function createControlledAmbience(context, environmentId, mix) {
  const profile = controlledRooms[environmentId];
  const nodes = [];
  const inputs = new Map();
  const convolvers = [];
  const own = node => { nodes.push(node); return node; };
  function dispose() {
    for (const node of nodes) node.disconnect();
    for (const node of convolvers) node.buffer = null;
    nodes.length = convolvers.length = 0;
    inputs.clear();
  }
  try {
    const direct = own(context.createGain());
    direct.connect(mix);
    const high = own(context.createBiquadFilter());
    high.type = 'highpass';
    high.frequency.value = profile.highpass;
    high.Q.value = .707;
    const low = own(context.createBiquadFilter());
    low.type = 'lowpass';
    low.frequency.value = Math.min(profile.lowpass, context.sampleRate * .45);
    low.Q.value = .707;
    high.connect(low);
    const wet = own(context.createGain());
    wet.gain.value = 0;
    wet.connect(mix);
    const paths = {};
    for (const size of ['short', 'long']) {
      const reverb = own(context.createConvolver());
      convolvers.push(reverb);
      reverb.normalize = false;
      reverb.buffer = controlledImpulse(context, environmentId, profile, size);
      const weight = own(context.createGain());
      weight.gain.value = size === 'short' ? 1 : 0;
      low.connect(reverb);
      reverb.connect(weight);
      weight.connect(wet);
      paths[size] = weight.gain;
    }
    for (const [layer, amount] of Object.entries(controlledSends)) {
      const input = own(context.createGain());
      const send = own(context.createGain());
      send.gain.value = amount;
      input.connect(direct);
      input.connect(send);
      send.connect(high);
      inputs.set(layer, input);
    }
    return {
      input: layer => inputs.get(layer) ?? direct,
      setDepth(depth, initialize) {
        const settings = spaceSettings(environmentId, depth);
        for (const [name, param] of Object.entries({ dry: direct.gain, wet: wet.gain, ...paths })) {
          if (initialize) param.value = settings[name];
          else param.setTargetAtTime(settings[name], context.currentTime, .08);
        }
      },
      dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

// Share cached impulse data with REMIX while keeping both signal graphs separate.
export function roomImpulse(context, environmentId, size) {
  return controlledImpulse(context, environmentId, controlledRooms[environmentId], size);
}

function controlledImpulse(context, environmentId, profile, size) {
  if (!impulses.has(context)) impulses.set(context, new Map());
  const cache = impulses.get(context);
  const key = environmentId + '/expressive/' + size;
  if (cache.has(key)) return cache.get(key);
  const rate = context.sampleRate;
  const length = Math.ceil(rate * profile[size]);
  const delay = Math.round(rate * profile.preDelay);
  const tail = length - delay;
  const buffer = context.createBuffer(2, length, rate);
  const long = size === 'long';
  // Color the diffuse tail before energy calibration. Broadband normalization
  // otherwise spends most of its energy above the soft instruments' passband.
  const lowCoefficient = 1 - Math.exp(-2 * Math.PI * profile.lowpass * (long ? .65 : 1) / rate);
  const highCoefficient = Math.exp(-2 * Math.PI * profile.highpass / rate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    let state = (channel === 0 ? 2159417 : 875897) + (long ? 7919 : 0);
    let low = 0, high = 0, previous = 0, energy = 0;
    for (let index = 0; index < tail; index++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      low += lowCoefficient * (state / 2147483648 - 1 - low);
      high = highCoefficient * (high + low - previous);
      previous = low;
      const bloom = Math.min(1, index / ((long ? .030 : .006) * rate));
      const sample = high * bloom * (1 - index / tail) ** (long ? 1.65 : 2.2);
      samples[delay + index] = sample;
      energy += sample * sample;
    }
    const reflections = profile.reflections * (long ? .45 : 1);
    const gain = .95 * Math.sqrt(1 - reflections ** 2) / Math.sqrt(energy);
    for (let index = delay; index < length; index++) samples[index] *= gain;
    // Sparse early arrivals keep the smaller Retro/Cyberpunk rooms defined.
    for (let tap = 0; tap < 3; tap++) {
      const index = delay + Math.round(rate * (.011 + tap * .017 + channel * .003));
      if (index < length) samples[index] += reflections * (tap === 1 ? -.5 : .65);
    }
    // Keep both rooms at the same energy so crossfading cannot add a gain step.
    const total = samples.reduce((sum, value) => sum + value * value, 0);
    const calibration = .95 / Math.sqrt(total);
    for (let index = delay; index < length; index++) samples[index] *= calibration;
  }
  cache.set(key, buffer);
  return buffer;
}

function impulseFor(context, environmentId, profile) {
  if (!impulses.has(context)) impulses.set(context, new Map());
  const cache = impulses.get(context);
  const key = environmentId;
  const cached = cache.get(key);
  if (cached) return cached;
  const rate = context.sampleRate;
  const length = Math.ceil(rate * profile.seconds);
  const buffer = context.createBuffer(2, length, rate);
  const delay = Math.round(rate * profile.preDelay);
  const tail = length - delay;
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    let state = channel === 0 ? 2159417 : 875897;
    for (let index = 0; index < tail; index++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const noise = state / 2147483648 - 1;
      const bloom = Math.min(1, index / (.016 * rate));
      const sample = noise * bloom * (1 - index / tail) ** 3.6;
      samples[delay + index] = sample;
    }
  }
  cache.set(key, buffer);
  return buffer;
}
