// Notes are MIDI semitones. Chord intervals are relative to each progression root.
const m7=[0,3,7,10], M7=[0,4,7,11], add9=[0,4,7,14], sus=[0,5,7,14];
export const musicPresets={
  underwater:{name:'D minor',tonic:62,scale:[0,2,3,5,7,8,10],bpm:76,bars:2,
    chords:[[0,m7],[8,M7],[3,add9],[10,[0,5,7,10]]],pad:'sine',bass:'sine',melody:'sine',attack:.55,release:.65,swing:0,drums:.43,
    notes:[[2,0],[8,4],[13,2]],kicks:[0,10],snares:[12],hats:[2,6,10,14]},
  dreamcore:{name:'F Lydian',tonic:65,scale:[0,2,4,6,7,9,11],bpm:92,bars:1,
    chords:[[0,[0,4,7,11,18]],[2,add9],[7,M7],[9,m7]],pad:'triangle',bass:'sine',melody:'sine',attack:.29,release:.55,swing:0,drums:.54,
    notes:[[1,3],[5,4],[10,6],[14,5]],kicks:[0,8],snares:[12],hats:[2,6,10,14]},
  space:{name:'A minor',tonic:57,scale:[0,2,3,5,7,8,10],bpm:84,bars:2,
    chords:[[0,sus],[5,[0,2,7,12]],[8,M7],[10,sus]],pad:'triangle',bass:'sine',melody:'triangle',attack:.65,release:.8,swing:0,drums:.5,
    notes:[[4,4],[10,6],[15,2]],kicks:[0,8],snares:[12],hats:[6,14]},
  retro:{name:'C major',tonic:60,scale:[0,2,4,5,7,9,11],bpm:88,bars:1,
    chords:[[0,[0,4,7,11,14]],[9,[0,3,7,10,14]],[2,[0,3,7,10,14]],[7,[0,4,7,10,14]]],pad:'sine',bass:'triangle',melody:'triangle',attack:.032,release:.35,swing:.29,drums:.72,
    notes:[[0,2],[3,4],[7,6],[10,5],[15,4]],kicks:[0,7,10],snares:[4,12],hats:[2,6,10,14]},
  cyberpunk:{name:'E Phrygian',tonic:64,scale:[0,1,3,5,7,8,10],bpm:110,bars:1,
    chords:[[0,m7],[1,[0,4,7,11]],[3,[0,4,7,10]],[0,[0,3,6,10]]],pad:'triangle',bass:'sawtooth',melody:'square',attack:.10,release:.20,swing:0,drums:.85,
    notes:[[0,0],[3,1],[6,2],[10,4],[14,1]],kicks:[0,6,8,14],snares:[4,12],hats:[2,5,7,10,13,15]}
};
