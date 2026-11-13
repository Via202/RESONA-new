const oscillator = (wave, mix = 1, ratio = 1, detune = 0) => ({ wave, mix, ratio, detune });
const tone = (oscillators, cutoff, sweep, sweepTime, attack, decay, sustain, release, gain, resonance = .25) =>
  ({ oscillators, cutoff, sweep, sweepTime, attack, decay, sustain, release, gain, resonance });

function kit({ kick, snare, hat, open, softHat }) {
  return {
    kick: {
      body: kick.slice(0, 3).concat(1), gate: .12, attack: .004, decay: .075,
      sustain: .24, release: kick[3], gain: kick[4]
    },
    snare: {
      body: [185, 132, .035, .24], noise: ['bandpass', snare[0], snare[1], .8],
      gate: .075, attack: .003, decay: .047, sustain: .22, release: snare[2], gain: snare[3]
    },
    hat: {
      noise: softHat ? ['bandpass', softHat.cutoff, .78, 1] : ['highpass', hat[0], .55, 1],
      gate: .045, attack: softHat ? .009 : .002,
      decay: .024, sustain: .19, release: hat[1], gain: softHat?.gain ?? hat[2]
    },
    'open-hat': {
      noise: ['highpass', hat[0], .6, 1], gate: .11, attack: .004,
      decay: .07, sustain: .42, release: open, gain: hat[2] * .83
    }
  };
}

function freezeProfiles(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeProfiles);
    Object.freeze(value);
  }
  return value;
}

export const soundProfiles = freezeProfiles({
  underwater: {
    chords: tone([oscillator('sine', .72), oscillator('triangle', .28, 1, 5)], 680, 1.65, .7, .34, .6, .82, .72, .21),
    bass: tone([oscillator('sine')], 240, .8, .2, .04, .18, .76, .19, .19),
    melody: tone([oscillator('sine', .77), oscillator('triangle', .23, 2)], 1050, 1.35, .22, .055, .24, .72, .24, .14),
    percussion: kit({ kick: [88, 44, .09, .12, .30], snare: [920, .65, .1, .24], hat: [4400, .025, .13], open: .18,
      softHat: { cutoff: 1250, gain: .07 } })
  },
  dreamcore: {
    chords: tone([oscillator('triangle', .72, 1, -4), oscillator('sine', .28, 2, 7)], 1350, 1.6, .6, .24, .72, .71, .67, .18),
    bass: tone([oscillator('triangle', .24), oscillator('sine', .76)], 310, .82, .23, .05, .14, .68, .18, .15),
    melody: tone([oscillator('sine', .77), oscillator('sine', .23, 2.01)], 2100, .58, .16, .024, .14, .32, .36, .14),
    percussion: kit({ kick: [97, 49, .062, .09, .27], snare: [1880, 1.35, .10, .23], hat: [6450, .031, .14], open: .23,
      softHat: { cutoff: 1900, gain: .08 } })
  },
  space: {
    chords: tone([oscillator('triangle', .62, 1, -7), oscillator('sawtooth', .38, 1, 8)], 820, 2.3, 1.1, .51, .7, .87, 1.05, .20),
    bass: tone([oscillator('sine', .75), oscillator('triangle', .25, 2)], 350, 1.35, .35, .052, .22, .83, .29, .22),
    melody: tone([oscillator('triangle', .82), oscillator('sine', .18, 2, 4)], 1470, 1.7, .30, .028, .28, .85, .40, .14),
    percussion: kit({ kick: [108, 42, .12, .20, .34], snare: [1320, .8, .17, .27], hat: [5100, .045, .14], open: .29 })
  },
  retro: {
    chords: tone([oscillator('triangle', .73), oscillator('sine', .27, 2, -3)], 1800, .43, .28, .018, .39, .42, .31, .22),
    bass: tone([oscillator('triangle', .7), oscillator('sine', .3)], 515, .61, .17, .018, .19, .56, .12, .21, .6),
    melody: tone([oscillator('triangle', .84), oscillator('sine', .16, 2, -5)], 1750, .66, .21, .023, .16, .61, .19, .15),
    percussion: kit({ kick: [111, 49, .068, .10, .34], snare: [1480, .87, .09, .30], hat: [5350, .027, .17], open: .19 })
  },
  cyberpunk: {
    chords: tone([oscillator('sawtooth', .53, 1, -8), oscillator('square', .47, 1, 6)], 870, 2.15, .19, .09, .23, .62, .28, .18, .85),
    bass: tone([oscillator('sawtooth', .62), oscillator('sine', .38)], 830, .43, .13, .009, .12, .44, .085, .25, .85),
    melody: tone([oscillator('square', .56), oscillator('triangle', .44, 1, 6)], 2550, .64, .13, .012, .12, .65, .12, .14, .55),
    percussion: kit({ kick: [155, 46, .046, .105, .40], snare: [2460, 1.05, .076, .33], hat: [7400, .021, .19], open: .16 })
  }
});
