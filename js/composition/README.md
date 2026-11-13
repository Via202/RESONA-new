# SONIC CHAOS — Loop-aware composition and melody

## Planner API

`generateComposition({ environmentId, seed, tempo })` in `planner.js` returns an immutable, JSON-serializable score. All arguments are optional. Defaults are Underwater, seed 0, and the selected environment's Stage B1 tempo. Seed values may be strings or safe integers. A tempo override is a positive finite number in BPM and applies to the full score.

The planner reads the Stage B1 preset's chord vocabulary, scale, tempo and swing. It calls the existing pure `chordAt()` helper and does not instantiate the music engine. M4 arrangement profiles supply phrase order, energy, bass patterns, percussion and articulation. Separate environment-scoped seeded streams govern harmony, energy, melody and groove. Identical inputs produce identical scores in the same planner revision. Different seeds can share individual phrases.

The score separates section boundaries, per-bar harmony, per-section energy with per-bar levels, per-bar layer states, and a chronological event list. Simultaneous events have a stable tie-breaker in `order`. Pitched events use MIDI notes. Drum events identify a percussion instrument and use normalized velocity, as do pitched events.

## Environment arrangements

`arrangement-profiles.js` holds five independent configurations consumed by the shared planner. Version 3 gains the additive `arrangementProfileId` field. Existing event, section, motif and loop fields retain their shape. The score's `environmentId` also selects the corresponding M3 palette through the existing instrument API. That API and the production preset definitions are unchanged.

| Environment | Arrangement |
| --- | --- |
| Underwater | Paired-bar harmonies, full-bar pad gates, one long root per verse bar, soft and sparse drums, and extended lead notes |
| Dreamcore | Quicker changes between Lydian chord colors, staggered bass and hats, offbeat snares, and short phrase-end drum surprises |
| Space | Long tonic pedal in the verse, broad chord blocks, an energy build through the chorus, sustained lead notes and transitional drum fills |
| Lo-fi Retro | Seventh and ninth chords with alternating gate lengths, moving bass with scale approaches, and preset swing plus a seeded zero-to-three tick delay on offbeats |
| Digital Cyberpunk | Frequent Phrygian tension chords, short chord gates, syncopated six-hit chorus bass cells, short lead notes, open hats and denser drum accents |

The profiles shape activity within the existing layer entrances, bridge withdrawals and final returns. The chorus raises energy and varies note density by environment. A profile can add drum fills at the ends of the chorus and final chorus. Each profile repeats its own opening drum pattern and energy at bar 32, where seeded pocket shifts are disabled. The suspended final harmony and carried common tone are preserved.

## Layer states

Each `arrangement` entry has a `layers` object keyed by `chords`, `bass`, `percussion`, and `melody`. Every state has an `active` boolean, a musical `role`, and a `transition`. The transition is `enter` for a first entrance, `return` for an entrance after an earlier active bar, `continue` for sustained presence, `exit` for the first inactive bar after activity, or `rest` for continuing inactivity. Bar 1 compares its state with bar 32 so the score describes the repeating seam. A fresh start still plays the events at tick 0.

Inactive layers emit no new events. Version 3 removes the M1 `eventsDeferred` marker. Active melody bars now contain actual note events.

Chords continue throughout. A light drum pulse opens the score, and bass enters at bar 2. Bass and percussion withdraw at the bridge. Percussion returns in half-time at bar 23, and bass returns at the final chorus. The outro returns to the opening pulse by bar 31. Bass drops out at bar 32 and rests through the first bar of the next cycle.

| Section | Bars | Tick interval | Musical function |
| --- | --- | --- | --- |
| Intro | 1–4 | [0, 1536) | Establish the opening harmony and pulse |
| Verse | 5–12 | [1536, 4608) | Develop the harmony over a steady groove |
| Chorus | 13–20 | [4608, 7680) | Raise energy and thicken the bass and percussion |
| Bridge | 21–24 | [7680, 9216) | Move away from the opening harmony, withdraw bass and drums, then return with half-time percussion |
| Final Chorus | 25–28 | [9216, 10752) | Return to the chorus entrance, then reorder and lift its closing voicings |
| Outro / Loop Transition | 29–32 | [10752, 12288) | Reduce density and guide the score back to the opening |

## Melody and motif data

The dedicated melody stream chooses a two-bar contour, a register, and a small rhythmic displacement within the environment profile. Verse phrases repeat the opening motif and adapt its pitches to the current harmony. The chorus keeps the motif rhythm and adds a response. The final chorus keeps the same motif ID, raises the target register, and shifts an inner onset and part of the contour. The first note of each active bar and notes on quarter-note beats use tones common to the scale and the bar's chord. Other notes use the scale. Durations leave room between notes, and velocity follows bar energy and accent placement.

| Environment | Melodic profile |
| --- | --- |
| Underwater | Sparse, gently curved lines with breathing room |
| Dreamcore | Delicate offbeat entries and occasional wider motion |
| Space | Broad, sustained notes and rising contours |
| Lo-fi Retro | Short syncopated notes with the existing preset swing |
| Digital Cyberpunk | Angular contours, quick notes and stronger accents |

The score stores the source cells and scale-degree offsets in `melody.motif`, phrase forms and bar ranges in `melody.phrases`, and the links from melody events back to both. The final offbeat in bar 28 sits one scale step from the opening melody note in bar 5. The outro and intro leave the lead silent while the accompaniment carries the transition. `melody.loopReturn` identifies the pickup, opening and any carried melody events by their event order IDs. In this version its carry list is empty. The existing chord carry remains in the score.

## Loop contract

The score uses 4/4 and 96 ticks per quarter note. The loop is **[0, 12288)**. Bar numbers are one-based and tick offsets are zero-based. The last bar uses a suspended tonic that shares the opening root and fifth. Its drum pattern, velocities, and energy match bar 1. A separately voiced fifth starts at tick 12192 and has a full duration of 192 ticks, with 96 ticks carrying into the next cycle. This keeps a common tone through the transition while the opening chord begins.

Every event onset belongs to one cycle. The `carry-duration` policy stores the full duration in `durationTicks` and the portion after the boundary in `carryTicks`. An event ending exactly at the boundary has zero carry. For cycle `n`, a renderer should schedule the onset at `n * lengthTicks + startTick` and release at that onset plus `durationTicks`. A carried voice remains active across the boundary and gets no extra onset at tick 0. Starting a fresh song at tick 0 does not synthesize a prior cycle's tail.

## Future playback requirements

- Repeat the same score continuously until Stop. Schedule each cycle against the audio clock so the transition has no audible gap.
- Pause preserves the exact musical position and Resume continues from it. Stop and Restart reset to tick 0.
- An environment selection during playback applies to the next generated song. The playing score remains fixed.
- A later renderer must define how it restores sustaining notes when resuming mid-event, and how it cancels queued events and releases tails on Stop.

These are requirements for playback integration. The current milestone tests the score and its boundary representation. It does not render audio or establish audible seamlessness.

## Implementation and verification

Production files inspected include `experience.html`, `js/app.js`, `js/audio.js`, `js/music-engine.js`, `js/music-presets.js`, `js/environments.js`, `tests/audio.test.mjs`, and `tests/music-engine.test.mjs`. The workspace has no Git metadata. The Stage B1 ZIP served as the reference for file integrity.

New files are `score.js` for timing and event boundaries, `random.js` for seeded variation, `harmony.js` for the harmonic plan, `arrangement.js` for layer roles, energy and events, `planner.js` for the public entry point, this README, and `tests/composition.test.mjs`. Existing production files match the Stage B1 archive byte for byte, including playback, AudioEngine, REMIX, uploads, the visualizer, and environments.

The final arrangement correction modified `arrangement.js`, `planner.js`, this README, and `tests/composition.test.mjs`. It added or deleted no project files.

M2 added `melody.js` and `tests/melody.test.mjs`. It modified `arrangement.js`, `planner.js`, this README, and `tests/composition.test.mjs`. No project files were deleted.

M4 added `arrangement-profiles.js` and `tests/arrangement-profiles.test.mjs`. It modified `arrangement.js`, `harmony.js`, `melody.js`, `planner.js`, and this README. No project files were deleted.

Run `node --test tests/*.test.mjs` from the project root. The extracted M4 delivery passed **78 tests, 0 failed, 0 skipped**. Tests compare actual chord changes, bass motion, percussion density, lead durations, section dynamics, seed variation, and loop events. The M3 integration test dispatches all event types from each score through the existing instrument API with a test graph. Audible mix, phrasing and loop quality remain to be evaluated during M5 playback integration.
