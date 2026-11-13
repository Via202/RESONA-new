import { createAmbience } from './ambience.js';
import { mixSettings } from './controls.js';

const curve = Float32Array.from({ length: 1025 }, (_, i) => .84 * Math.tanh((i / 512 - 1) * 1.8));

export function createCreativeMix(context, environmentId, output, values) {
  const nodes = [];
  const own = node => { nodes.push(node); return node; };
  let room;
  function dispose() {
    room?.dispose();
    for (const node of nodes) node.disconnect();
    nodes.length = 0;
  }
  try {
    const sum = own(context.createGain());
    const color = own(context.createBiquadFilter());
    color.type = 'highshelf';
    color.frequency.value = Math.min(2800, context.sampleRate * .35);
    const dry = own(context.createGain());
    const drive = own(context.createGain());
    const shaper = own(context.createWaveShaper());
    shaper.curve = curve;
    shaper.oversample = '2x';
    const saturated = own(context.createGain());
    sum.connect(color);
    color.connect(dry);
    dry.connect(output);
    color.connect(drive);
    drive.connect(shaper);
    shaper.connect(saturated);
    saturated.connect(output);
    room = createAmbience(context, environmentId, sum, true);
    const layers = Object.fromEntries(['chords', 'bass', 'percussion', 'melody'].map(name => {
      const gain = own(context.createGain());
      gain.connect(room.input(name));
      return [name, gain];
    }));
    function update(state, initialize = false) {
      const settings = mixSettings(state);
      const smooth = (param, value) => {
        if (initialize) param.value = value;
        else param.setTargetAtTime(value, context.currentTime, .025);
      };
      for (const [name, value] of Object.entries(settings.layers)) {
        const gain = layers[name].gain;
        if (name === 'melody' && !initialize) gain.cancelScheduledValues(context.currentTime);
        smooth(gain, value);
        if (name === 'melody' && !initialize && value === 0) {
          gain.setValueAtTime(0, context.currentTime + .18);
        }
      }
      smooth(color.gain, settings.brightness);
      smooth(dry.gain, settings.dry);
      smooth(drive.gain, settings.drive);
      smooth(saturated.gain, settings.saturated);
      room.setDepth(settings.space, initialize);
    }
    update(values, true);
    return { input: layer => layers[layer], update, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
