import { musicPresets } from '../music-presets.js';

export const liveNames = Object.freeze(['color', 'distortion', 'energy', 'melody', 'space']);
const defaults = {
  underwater: [45, 23, 40, 18, 27, 31, 64, 63],
  dreamcore: [54, 41, 40, 16, 39, 45, 68, 65],
  space: [50, 29, 40, 14, 47, 39, 72, 78],
  retro: [43, 40, 40, 24, 50, 56, 70, 26],
  cyberpunk: [61, 58, 40, 32, 69, 66, 70, 33]
};
const names = ['color', 'chaos', 'speed', 'distortion', 'energy', 'density', 'melody', 'space'];
export const controlDefaults = Object.freeze(Object.fromEntries(Object.entries(defaults).map(([id, values]) =>
  [id, Object.freeze(Object.fromEntries(names.map((name, index) => [name, values[index]])))]
)));

export function controlValue(value) {
  if (!Number.isFinite(value)) throw new RangeError('Expected a numeric creative control value.');
  return Math.max(0, Math.min(100, value));
}

export function generationSettings(environmentId, draft) {
  const speed = controlValue(draft.speed);
  const ratio = speed < 40 ? .75 + speed / 160 : 1 + (speed - 40) / 200;
  return {
    tempo: Math.round(musicPresets[environmentId].bpm * ratio),
    density: controlValue(draft.density), chaos: controlValue(draft.chaos)
  };
}

export function mixSettings(values) {
  const read = name => controlValue(values[name]) / 100;
  const energy = read('energy');
  const distortion = read('distortion');
  return {
    layers: { chords: .98, bass: .72 + .36 * energy, percussion: .30 + .8 * energy,
      melody: read('melody') ** 1.25 * 1.12 },
    brightness: -9 + 13 * read('color'),
    drive: 1 + 2 * distortion,
    dry: 1 - .75 * distortion,
    saturated: .52 * distortion,
    space: read('space')
  };
}

export class CreativeControls {
  constructor(environmentId) { this.selectEnvironment(environmentId); }

  selectEnvironment(environmentId) {
    this.environmentId = environmentId;
    this.draft = { ...controlDefaults[environmentId] };
  }

  set(name, value) {
    this.draft[name] = controlValue(value);
    if (this.live && liveNames.includes(name)) this.live[name] = this.draft[name];
  }

  reset() {
    this.selectEnvironment(this.environmentId);
    if (this.score?.environmentId === this.environmentId) this.live = this.liveFor(this.draft);
  }

  liveFor(values) { return Object.fromEntries(liveNames.map(name => [name, values[name]])); }

  capture() { return Object.freeze(this.liveFor(this.draft)); }

  activate(score) {
    if (this.score !== score) {
      this.score = score;
      this.live = this.liveFor(score.environmentId === this.environmentId ? this.draft :
        score.liveDefaults ?? controlDefaults[score.environmentId]);
    }
    return this.live;
  }
}
