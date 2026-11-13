# SONIC CHAOS M3 — Instrument and sound design system

M3 translates a single approved composition event into one native Web Audio voice. It is a standalone library. The current CREATE and REMIX playback paths still use their existing production code.

## Integration contract

Import `scheduleInstrumentEvent` from `js/instruments/index.js`. Supply the existing context, an intermediate output node created by that context, the environment ID, a score event, the audio-clock start time in seconds, and the note duration in seconds. For a constant-tempo score, one tick is `60 / score.tempo / score.ticksPerQuarter` seconds. Keep the full duration of a carried event when making the conversion.

```js
const voice = scheduleInstrumentEvent({
  context, output: layerBus, environmentId: score.environmentId, event,
  time: cycleStartTime + event.startTick * secondsPerTick,
  duration: event.durationTicks * secondsPerTick
});
activeVoices.add(voice);
voice.done.then(() => activeVoices.delete(voice));
```

The caller owns the context, output routing, audio clock, and active voice collection. The library never resumes or closes the context, creates an analyser, or connects an instrument to the destination. The eventual renderer can connect its mix through the existing AudioEngine external-source interface. The implementation has no timer or playback scheduler.

The entry point validates the layer, kind, environment, velocity in [0, 1], and positive duration up to 300 seconds. Pitches are integer MIDI notes from 0 through 127. Chord events take up to eight pitches. The carried chord tone uses the same pad voice with one pitch. Invalid inputs throw before starting any sound. A requested onset in the past is clamped to the current audio time.

## Voice families

- Pads combine up to two oscillators per pitch. A shared envelope scales with chord size, and a low-pass sweep shapes the chord as it develops.
- Bass uses one or two oscillators, a profile-specific low-pass sweep, and a 26 Hz high-pass filter to limit rumble.
- Lead uses a separate envelope and oscillator mix to preserve the score's pitch and articulation.
- Kick uses a falling sine pitch. Snare adds a short pitched body to band-passed noise. Hats use high-passed noise and separate envelopes for closed and open articulations. The score identity `hat` maps to closed hat. `closed-hat` and `open-hat` are supported explicitly. M2 does not emit open hats. Percussion treats the supplied duration as a gate and caps it per hit so a long input cannot sustain a drum indefinitely.

The noise is generated in memory and reused per context through a weak cache. No samples, downloads, or third-party dependencies are required.

| Environment | Pad and lead | Bass and percussion |
| --- | --- | --- |
| Underwater | Soft sine and triangle layers with a slow filter opening | Rounded sine bass and muted drums |
| Dreamcore | Airy harmonics and a bell-like lead with an inharmonic overtone | Gentle bass, a narrow snare band and delicate hats |
| Space | Detuned, slowly opening pads and sustained lead | Deep bass and longer cinematic drum tails |
| Lo-fi Retro | Fast attack and downward filtering for a mellow keyboard character | Rounded triangle bass and classic short drum hits |
| Digital Cyberpunk | Detuned saw and square pads and a focused bright lead | Fast filtered bass and sharp kick and snare transients |

## Voice lifecycle

Each handle exposes `startTime`, `endsAt`, `release(atTime)`, `cancel()`, and a `done` promise. Sources start once and have an explicit audio-clock stop time. `release()` before the normal gate end shortens the gate and ramps from its current level to silence. Releasing at or before the onset cancels the queued voice. `cancel()` stops sources and detaches the voice immediately, which can cut a currently audible sound. Use release for a smooth stop.

When all sources end, the voice removes its callbacks and disconnects only the nodes it created. Setup errors roll back the graph. The promise resolves to `ended`, `released`, or `cancelled`. If the renderer shuts down or closes a context before natural endings can be delivered, it should explicitly cancel its retained handles. Each repeated note has its own graph. A future renderer owns any cross-voice polyphony budget and mix headroom.

## Verification and remaining work

The M2 baseline passed 66 tests. M3 adds eight tests for profile differences, MIDI frequency and envelopes, early release with and without native hold automation, independent repeated notes, percussion mapping, argument validation, graph rollback, and mapping all five generated scores. The extracted delivery passed **74 tests, 0 failed, 0 skipped**. Tests use a Web Audio graph double. Listening quality, performance on real devices, and browser-specific audio rendering were not verified in M3.

M4 can refine the palettes and layer mixes in the context of whole arrangements. M5 will own transport, real-time scheduling, analyser routing, loop continuity, and stop or pause behavior.

M3 created `index.js`, `profiles.js`, `voice.js`, `tonal.js`, `chords.js`, `bass.js`, `percussion.js`, `lead.js`, and this README under `js/instruments/`, plus `tests/instruments.test.mjs`. No existing project files were modified or deleted.
