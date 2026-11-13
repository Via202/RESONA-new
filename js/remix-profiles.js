// Defaults are applied on initial load and explicit Reset, never on a world switch.
const defaults = (chaos, speed, color, distortion, energy, space) =>
  Object.freeze({ chaos, speed, color, distortion, energy, space });

export const remixProfiles = Object.freeze({
  underwater: Object.freeze({
    defaults: defaults(35, 40, 50, 35, 30, 25),
    shelf: -4.5, frequency: 1800, drive: 1.5, saturation: .62,
    threshold: 14, ratio: 1.6, attack: .026, release: .20,
    highpass: 200, lowpass: 2900, wet: .43, long: .70
  }),
  dreamcore: Object.freeze({
    defaults: defaults(41, 40, 55, 18, 24, 40),
    shelf: 2, frequency: 3200, drive: 1.3, saturation: .54,
    threshold: 13, ratio: 1.4, attack: .025, release: .19,
    highpass: 300, lowpass: 5200, wet: .37, long: .62
  }),
  space: Object.freeze({
    defaults: defaults(29, 40, 52, 16, 28, 63),
    shelf: .5, frequency: 2600, drive: 1.6, saturation: .57,
    threshold: 16, ratio: 1.7, attack: .025, release: .22,
    highpass: 340, lowpass: 4600, wet: .52, long: 1
  }),
  retro: Object.freeze({
    defaults: defaults(40, 40, 46, 38, 36, 27),
    shelf: -3, frequency: 2600, drive: 1.9, saturation: .72,
    threshold: 16, ratio: 1.7, attack: .028, release: .23,
    highpass: 230, lowpass: 3200, wet: .33, long: .24
  }),
  cyberpunk: Object.freeze({
    defaults: defaults(58, 40, 59, 48, 57, 34),
    shelf: 3.5, frequency: 2100, drive: 2.6, saturation: .87,
    threshold: 21, ratio: 2.7, attack: .014, release: .15,
    highpass: 310, lowpass: 4400, wet: .42, long: .47
  })
});
