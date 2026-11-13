import { freezeScore } from './score.js';

// Harmony strings use the four chord indices in each environment's B1 preset.
// Bass cells are [sixteenth onset, pitch role, sixteenth length].
// Energy rows follow the six sections in score order.
const root = 'root', fifth = 'fifth', color = 'color', approach = 'approach', pedal = 'pedal';
export const arrangementProfiles = freezeScore({
  underwater: {
    harmony: {
      intro: ['0011'], verse: ['00110033', '00221133', '00331100'], chorus: ['00112233', '00221133', '00332211'],
      bridge: ['2211', '1122'], outro: ['210', '120']
    },
    energy: [[.25,.28,.32,.37],[.39,.41,.43,.45,.44,.46,.47,.48],[.57,.59,.61,.62,.59,.61,.63,.64],
      [.36,.38,.42,.46],[.62,.65,.70,.66],[.53,.44,.34,.25]],
    chordGates: [384,384], chordGain: 1,
    bass: { anchor: [[0,root,11]], driving: [[0,root,8],[10,fifth,4]], gain: .77 },
    drums: {
      'loop-pulse': { hat: [6,14] }, groove: { kick: [0], hat: [6,14] },
      'half-time': { kick: [0], hat: [14] }, full: { kick: [0,10], hat: [2,10,14] }
    },
    drumGain: .62, lead: { gate: 1.17, gain: .88, featuredLift: 1, finalLift: 2 }
  },
  dreamcore: {
    harmony: {
      intro: ['0021'], verse: ['01210312', '02120321', '03120312'], chorus: ['02130213', '01320132', '03210321'],
      bridge: ['3112', '2331'], outro: ['310', '230']
    },
    energy: [[.29,.34,.31,.43],[.47,.44,.52,.48,.46,.53,.49,.54],[.68,.71,.67,.75,.69,.74,.70,.77],
      [.43,.38,.49,.54],[.72,.76,.83,.74],[.61,.47,.36,.29]],
    chordGates: [384,384], chordGain: .93,
    bass: { anchor: [[0,root,6],[11,color,2]], driving: [[0,root,5],[7,fifth,3],[13,color,2]], gain: .8 },
    drums: {
      'loop-pulse': { kick: [0], hat: [5,13] }, groove: { kick: [0,9], hat: [3,7,13] },
      'half-time': { hat: [5,13] }, full: { kick: [0,9], hat: [3,7,13] }
    },
    fill: { hat: [15] }, drumGain: .73, lead: { gate: .89, gain: .93, featuredLift: 1, finalLift: 2 }
  },
  space: {
    harmony: {
      intro: ['0001'], verse: ['00001122', '00002211', '00110022'], chorus: ['00221133', '00112233', '00223311'],
      bridge: ['2221', '1112'], outro: ['230', '320']
    },
    energy: [[.28,.34,.40,.45],[.46,.47,.49,.51,.54,.56,.58,.60],[.72,.75,.78,.81,.82,.84,.86,.89],
      [.41,.44,.52,.63],[.82,.88,.94,.91],[.69,.55,.40,.28]],
    chordGates: [384,384], chordGain: 1.05,
    bass: { anchor: [[0,pedal,14]], driving: [[0,root,9],[10,fifth,5]], gain: .94 },
    drums: {
      'loop-pulse': { kick: [0], hat: [14] }, groove: { kick: [0,8], hat: [6,14] },
      'half-time': { kick: [0], hat: [14] }, full: { kick: [0,8], hat: [14] }
    },
    fill: { kick: [10], 'open-hat': [15] }, drumGain: 1, lead: { gate: 1.16, gain: 1, featuredLift: 2, finalLift: 3 }
  },
  retro: {
    harmony: {
      intro: ['0123'], verse: ['01230123', '02130123', '01230023'], chorus: ['02310231', '01230123', '01320123'],
      bridge: ['1213', '2132'], outro: ['230', '130']
    },
    energy: [[.36,.42,.47,.51],[.53,.55,.52,.57,.54,.56,.58,.57],[.68,.72,.69,.75,.70,.74,.72,.76],
      [.52,.49,.55,.60],[.73,.76,.82,.77],[.63,.52,.44,.36]],
    chordGates: [252,210], chordGain: .98,
    bass: { anchor: [[0,root,4],[6,fifth,3],[11,approach,3]], driving: [[0,root,3],[5,color,3],[9,fifth,2],[13,approach,2]], gain: .93 },
    drums: {
      'loop-pulse': { kick: [0,7], hat: [3,7,11,14] }, groove: { kick: [0,7,10], snare: [4,12], hat: [2,6,11,14] },
      'half-time': { kick: [0,7], snare: [12], hat: [6,11,14] }, full: { kick: [0,7,10], snare: [4,12], hat: [2,5,6,11,14] }
    },
    fill: { 'open-hat': [15] }, pocket: 3, drumGain: .82, lead: { gate: .96, gain: .95, featuredLift: 1, finalLift: 2 }
  },
  cyberpunk: {
    harmony: {
      intro: ['0103'], verse: ['01030123', '03120103', '03010312'], chorus: ['01320132', '03120312', '02310231'],
      bridge: ['3312', '3131'], outro: ['310', '130']
    },
    energy: [[.39,.46,.52,.57],[.55,.58,.57,.61,.59,.63,.61,.65],[.78,.82,.84,.81,.85,.87,.86,.89],
      [.47,.42,.55,.66],[.87,.91,.96,.93],[.73,.59,.49,.39]],
    chordGates: [320,270], chordGain: .98,
    bass: { anchor: [[0,root,2],[3,root,2],[8,fifth,2],[13,approach,2]],
      driving: [[0,root,2],[3,root,1],[6,color,1],[8,root,2],[11,fifth,1],[14,approach,1]], gain: 1.08 },
    drums: {
      'loop-pulse': { kick: [0,6,8], hat: [2,5,10,13] },
      groove: { kick: [0,6,8,14], snare: [4,12], hat: [2,5,7,10,13] },
      'half-time': { kick: [0,7,10], snare: [12], hat: [2,6,10,14] },
      full: { kick: [0,3,6,8,11,14], snare: [4,12], hat: [2,5,7,10,13], 'open-hat': [15] }
    },
    fill: { snare: [13,15] }, drumGain: 1.08, lead: { gate: .80, gain: 1.08, featuredLift: 1, finalLift: 3 }
  }
});
