// Alternatives reuse the preset's seam and bridge pulse. Cells repeat by role.
const root = 'root', fifth = 'fifth', color = 'color', approach = 'approach';

export const accompaniment = {
  underwater: {
    bass: [
      { anchor: [[0, root, 15]], driving: [[0, root, 14]] },
      { anchor: [[0, root, 8], [12, fifth, 3]], driving: [[0, root, 7], [8, fifth, 6]] }
    ],
    drums: [
      { groove: { kick: [0], hat: [10] }, full: { kick: [0, 8], hat: [6, 14] } },
      { groove: { kick: [0, 12], hat: [7] }, full: { kick: [0, 12], hat: [3, 7, 15] } }
    ]
  },
  dreamcore: {
    bass: [
      { anchor: [[0, root, 9]], driving: [[0, root, 8], [11, color, 4]] },
      { anchor: [[0, root, 5], [8, fifth, 4]], driving: [[0, root, 4], [6, color, 4], [12, fifth, 3]] }
    ],
    drums: [
      { groove: { kick: [0], hat: [5, 11] }, full: { kick: [0, 11], hat: [5, 8, 14] } },
      { groove: { kick: [0, 10], hat: [2, 7, 14] }, full: { kick: [0, 7], hat: [2, 9, 13] } }
    ]
  },
  space: {
    bass: [
      { anchor: [[0, root, 15]], driving: [[0, root, 15]] },
      { anchor: [[0, root, 10], [12, fifth, 4]], driving: [[0, root, 10], [12, fifth, 4]] }
    ],
    drums: [
      { groove: { kick: [0], hat: [12] }, full: { kick: [0, 12], hat: [14] } },
      { groove: { kick: [0, 10], hat: [14] }, full: { kick: [0, 7], hat: [14] } }
    ]
  },
  retro: {
    bass: [
      { anchor: [[0, root, 5], [8, fifth, 4]], driving: [[0, root, 4], [7, color, 3], [12, approach, 3]] },
      { anchor: [[0, root, 3], [5, color, 3], [12, approach, 3]],
        driving: [[0, root, 3], [6, fifth, 2], [9, root, 2], [14, approach, 2]] }
    ],
    drums: [
      { groove: { kick: [0, 6], snare: [4, 12], hat: [2, 7, 10, 15] },
        full: { kick: [0, 6, 11], snare: [4, 12], hat: [2, 7, 10, 13] } },
      { groove: { kick: [0, 3, 9], snare: [4, 12], hat: [3, 6, 10, 15] },
        full: { kick: [0, 3, 9, 14], snare: [4, 12], hat: [3, 6, 10, 13] } }
    ]
  },
  cyberpunk: {
    bass: [
      { anchor: [[0, root, 3], [4, root, 2], [9, fifth, 2], [12, root, 3]],
        driving: [[0, root, 2], [4, root, 2], [7, color, 1], [9, fifth, 2], [12, root, 3]] },
      { anchor: [[0, root, 2], [3, fifth, 2], [7, root, 2], [11, approach, 3]],
        driving: [[0, root, 2], [3, fifth, 2], [7, root, 2], [10, color, 2], [13, approach, 2]] }
    ],
    drums: [
      { groove: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
        full: { kick: [0, 4, 8, 12, 15], snare: [4, 12], hat: [2, 6, 10, 14], 'open-hat': [7] } },
      { groove: { kick: [0, 3, 7, 10], snare: [4, 11], hat: [2, 6, 9, 14] },
        full: { kick: [0, 3, 7, 10, 14], snare: [4, 11], hat: [2, 5, 9, 12], 'open-hat': [15] } }
    ]
  }
};

// Withdraw one backing layer at phrase boundaries while retaining the lead,
// section entrances and the final two bars of the loop.
export const layerBreaks = [
  {},
  { 3: 'percussion', 12: 'bass', 26: 'percussion' },
  { 4: 'bass', 16: 'percussion', 30: 'bass' }
];
