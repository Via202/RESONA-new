import { roomImpulse } from './create/ambience.js';
import { remixProfiles } from './remix-profiles.js';

const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0;
const curve = transform => Float32Array.from({ length: 2049 }, (_, index) => transform(index / 1024 - 1));
const saturation = curve(value => Math.tanh(value * 1.6) / 1.6);
const ceiling = curve(value => {
  const magnitude = Math.abs(value);
  return Math.sign(value) * (magnitude <= .82 ? magnitude : .82 + .16 * Math.tanh((magnitude - .82) / .16));
});

export function remixSettings(values, environmentId = 'underwater') {
  const profile = remixProfiles[environmentId];
  const color = clamp(values.color), drive = clamp(values.distortion);
  const energy = clamp(values.energy), space = clamp(values.space);
  return {
    shelf: profile.shelf + (color - .5) * 12,
    frequency: profile.frequency,
    drive: 1 + drive * profile.drive,
    saturation: drive * profile.saturation,
    threshold: -9 - energy * profile.threshold,
    ratio: 1 + energy * profile.ratio,
    attack: profile.attack,
    release: profile.release,
    makeup: 1 + energy * .13,
    room: profile.long * space ** 1.4,
    highpass: profile.highpass,
    lowpass: profile.lowpass,
    wet: profile.wet * space ** 1.15,
    dry: 1 - .24 * space
  };
}

export function createRemixEffects(context, destination, values, processed, environmentId) {
  const nodes = [];
  const rooms = [];
  const own = node => { nodes.push(node); return node; };
  const gain = () => own(context.createGain());
  function dispose() {
    for (const node of nodes) node.disconnect();
    for (const room of rooms) room.buffer = null;
    nodes.length = rooms.length = 0;
  }
  try {
    const input = gain();
    const original = gain(), effectOutput = gain();
    input.connect(original).connect(destination);
    const shelf = own(context.createBiquadFilter());
    shelf.type = 'highshelf';
    const compressor = own(context.createDynamicsCompressor());
    compressor.knee.value = 14;
    const makeup = gain();
    input.connect(shelf).connect(compressor).connect(makeup);

    const clean = gain(), drive = gain(), shaped = gain(), sum = gain();
    const shaper = own(context.createWaveShaper());
    shaper.curve = saturation;
    shaper.oversample = '2x';
    makeup.connect(clean).connect(sum);
    makeup.connect(drive).connect(shaper).connect(shaped).connect(sum);

    const dry = gain(), wet = gain(), mix = gain();
    sum.connect(dry).connect(mix);
    wet.connect(mix);
    const high = own(context.createBiquadFilter());
    high.type = 'highpass';
    high.Q.value = .707;
    const low = own(context.createBiquadFilter());
    low.type = 'lowpass';
    low.Q.value = .707;
    sum.connect(high).connect(low);
    const weights = ['short', 'long'].map(size => {
      const room = own(context.createConvolver()), weight = gain();
      rooms.push(room);
      room.normalize = false;
      room.buffer = roomImpulse(context, 'space', size);
      low.connect(room).connect(weight).connect(wet);
      return weight.gain;
    });
    const limiter = own(context.createWaveShaper());
    limiter.curve = ceiling;
    mix.connect(limiter).connect(effectOutput).connect(destination);

    function update(state, enabled, environment, initialize = false) {
      const settings = remixSettings(state, environment);
      const smooth = (param, value, constant = .045) => {
        if (initialize) param.value = value;
        else param.setTargetAtTime(value, context.currentTime, constant);
      };
      smooth(original.gain, enabled ? 0 : 1);
      smooth(effectOutput.gain, enabled ? 1 : 0);
      smooth(shelf.gain, settings.shelf);
      smooth(shelf.frequency, Math.min(settings.frequency, context.sampleRate * .3));
      smooth(compressor.threshold, settings.threshold);
      smooth(compressor.ratio, settings.ratio);
      smooth(compressor.attack, settings.attack);
      smooth(compressor.release, settings.release);
      smooth(makeup.gain, settings.makeup);
      smooth(drive.gain, settings.drive);
      smooth(clean.gain, 1 - settings.saturation);
      smooth(shaped.gain, settings.saturation / settings.drive);
      smooth(dry.gain, settings.dry, .08);
      smooth(wet.gain, settings.wet, .08);
      smooth(high.frequency, settings.highpass, .08);
      smooth(low.frequency, Math.min(settings.lowpass, context.sampleRate * .45), .08);
      smooth(weights[0], 1 - settings.room, .08);
      smooth(weights[1], settings.room, .08);
    }
    update(values, processed, environmentId, true);
    return { input, update, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
