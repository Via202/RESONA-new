import { musicPresets } from '../music-presets.js';
import { BAR_COUNT, LOOP_LENGTH, METER, TICKS_PER_BAR, TICKS_PER_QUARTER, buildSections, compareEvents, freezeScore } from './score.js';
import { seededRandom } from './random.js';
import { planHarmony } from './harmony.js';
import { planArrangement, planEvents } from './arrangement.js';
import { composeMelody } from './melody.js';
import { arrangementProfiles } from './arrangement-profiles.js';
import { accompaniment, layerBreaks } from './variety.js';

export function generateComposition({ environmentId = 'underwater', seed = 0, tempo, density, chaos } = {}) {
  if (typeof environmentId !== 'string' || !Object.hasOwn(musicPresets, environmentId)) {
    throw new RangeError('Unknown composition environment: ' + environmentId);
  }
  const preset = musicPresets[environmentId];
  const profile = arrangementProfiles[environmentId];
  const bpm = tempo === undefined ? preset.bpm : tempo;
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError('Tempo must be a positive finite BPM value.');
  for (const value of [density, chaos]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new RangeError('Expected Density and Chaos in [0, 100].');
    }
  }

  const sections = buildSections();
  const harmony = planHarmony(sections, preset, profile, seededRandom(seed, environmentId + '/harmony'));
  const choose = (alternatives, stream) =>
    alternatives[Math.floor(seededRandom(seed, environmentId + '/' + stream)() * alternatives.length)];
  const variation = accompaniment[environmentId];
  const backing = {
    ...profile,
    bass: { ...profile.bass, ...choose([{}, ...variation.bass], 'bass-family') },
    drums: { ...profile.drums, ...choose([{}, ...variation.drums], 'drum-family') }
  };
  const { energy, arrangement } = planArrangement(sections, profile, seededRandom(seed, environmentId + '/arrangement'),
    choose(layerBreaks, 'layer-breaks'));
  const events = planEvents(harmony, energy, arrangement, preset, backing, seededRandom(seed, environmentId + '/groove'), density);
  const lead = composeMelody({
    environmentId, preset, harmony, energy, arrangement, articulation: profile.lead,
    random: seededRandom(seed, environmentId + '/melody'), firstOrder: events.length,
    bassEvents: events.filter(event => event.layer === 'bass'), density, chaos
  });
  events.push(...lead.events);
  events.sort(compareEvents);
  return freezeScore({
    version: 3,
    seed: seed === 0 ? 0 : seed,
    environmentId,
    arrangementProfileId: environmentId,
    tempo: bpm,
    ...(density !== undefined || chaos !== undefined ? {
      generation: { tempo: bpm, ...(density !== undefined && { density }), ...(chaos !== undefined && { chaos }) }
    } : {}),
    meter: METER,
    ticksPerQuarter: TICKS_PER_QUARTER,
    ticksPerBar: TICKS_PER_BAR,
    barCount: BAR_COUNT,
    loop: { startTick: 0, endTickExclusive: LOOP_LENGTH, lengthTicks: LOOP_LENGTH, boundaryPolicy: 'carry-duration' },
    tonality: { name: preset.name, tonicMidi: preset.tonic, scale: [...preset.scale] },
    sections, harmony, energy, arrangement, melody: lead.melody, events
  });
}
