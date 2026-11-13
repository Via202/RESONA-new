import { chordAt } from '../music-engine.js';
import { barStart } from './score.js';

export function planHarmony(sections, preset, profile, random) {
  let chorus;
  return sections.flatMap(section => {
    const { id, firstBar } = section;
    let phrase;
    if (id === 'final-chorus') {
      // Keep the chorus entrance, then change its second half and lift the voicing.
      phrase = [chorus[0], chorus[1], chorus[3], chorus[2]];
    } else {
      const choices = profile.harmony[id];
      phrase = Array.from(choices[Math.floor(random() * choices.length)], Number);
      if (id === 'outro') phrase.push(null);
      if (id === 'chorus') chorus = phrase;
    }
    return phrase.map((chordIndex, index) => {
      const bar = firstBar + index;
      const isReturn = chordIndex === null;
      const chord = isReturn
        ? { root: preset.tonic, notes: [preset.tonic, preset.tonic + 5, preset.tonic + 7] }
        : chordAt(preset, chordIndex * preset.bars);
      const pitches = [...new Set(chord.notes)].sort((a, b) => a - b);
      if (id === 'final-chorus' && index >= 2) {
        let lifted = pitches.shift() + 12;
        while (lifted <= pitches.at(-1)) lifted += 12;
        pitches.push(lifted);
      }
      return {
        bar, sectionId: id, startTick: barStart(bar), rootMidi: chord.root, pitches,
        role: isReturn ? 'tonic-suspension' : chordIndex === 0 ? 'home' : 'development',
        presetChordIndex: chordIndex
      };
    });
  });
}
