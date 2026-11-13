import { scheduleInstrumentEvent } from '../instruments/index.js';
import { LOOP_LENGTH, TICKS_PER_BAR } from '../composition/score.js';
import { createAmbience } from './ambience.js';
import { createCreativeMix } from './creative-mix.js';

const POLL_MS = 25;
const AHEAD = .14;
const START_LEAD = .05;
const FADE_IN = .012;
const FADE_OUT = .025;
const EPSILON = 1e-8;
const MAX_VOICES = 48;

function cursorAt(score, elapsed) {
  let cycle = Math.floor((elapsed + EPSILON) / score.cycleSeconds);
  const offset = elapsed - cycle * score.cycleSeconds;
  let low = 0;
  let high = score.events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (score.events[middle].at < offset - EPSILON) low = middle + 1;
    else high = middle;
  }
  if (low === score.events.length) { cycle++; low = 0; }
  return { cycle, index: low };
}

export class CreatePlayback {
  constructor({ context, connect, disconnect, onError = () => {}, timers = globalThis,
    scheduleVoice = scheduleInstrumentEvent }) {
    Object.assign(this, { context, connect, disconnect, onError, timers, scheduleVoice });
    this.master = context.createGain();
    this.master.gain.value = .42;
    this.elapsed = 0;
    this.state = 'stopped';
    this.contextChanged = () => {
      if (context.state === 'closed') {
        this.fail(new Error('The audio context closed.'));
      } else if (context.state === 'running') {
        this.tick();
      } else {
        this.clearRetired();
      }
    };
    context.addEventListener('statechange', this.contextChanged);
  }

  setVolume(value) {
    if (Number.isFinite(value) && this.context.state !== 'closed') {
      this.master.gain.setTargetAtTime(Math.min(1, Math.max(0, value)) * .60, this.context.currentTime, .025);
    }
  }

  setControls(values) {
    this.controls = { ...values };
    this.run?.creative?.update(this.controls);
  }

  get position() {
    const elapsed = this.run ? this.elapsedAt(this.run) : this.elapsed;
    const absoluteTicks = this.score ? elapsed / this.score.secondsPerTick : 0;
    const cycle = Math.floor((absoluteTicks + EPSILON) / LOOP_LENGTH);
    const tick = Math.max(0, absoluteTicks - cycle * LOOP_LENGTH);
    return { cycle, tick, bar: Math.floor(tick / TICKS_PER_BAR) + 1 };
  }

  elapsedAt(run) {
    return run.offset + Math.max(0, this.context.currentTime - run.clockStart);
  }

  play(score) {
    if (this.disposed || this.run || !score) return;
    if (this.context.state !== 'running') throw new Error('The audio context is not running.');
    if (score !== this.score) { this.score = score; this.elapsed = 0; }
    const bus = this.context.createGain();
    const clockStart = this.context.currentTime + START_LEAD;
    bus.gain.value = 0;
    bus.gain.setValueAtTime(0, clockStart);
    bus.gain.linearRampToValueAtTime(1, clockStart + FADE_IN);
    const run = {
      bus, clockStart, offset: this.elapsed, cursor: cursorAt(score, this.elapsed), voices: new Set()
    };
    this.run = run;
    try {
      bus.connect(this.master);
      if (this.controls) run.creative = createCreativeMix(this.context, score.environmentId, bus, this.controls);
      else run.ambience = createAmbience(this.context, score.environmentId, bus);
      if (!this.attached) { this.connect(this.master); this.attached = true; }
      this.state = 'playing';
      this.restore(run);
      this.pump(run);
      run.timer = this.timers.setInterval(() => this.tick(), POLL_MS);
    } catch (error) {
      this.stop();
      this.silence();
      throw error;
    }
  }

  schedule(run, item, time, offset = 0) {
    if (run.voices.size >= MAX_VOICES) throw new Error('CREATE polyphony limit reached.');
    const voice = this.scheduleVoice({
      context: this.context, output: run.creative?.input(item.event.layer) ?? run.ambience?.input(item.event.layer) ?? run.bus,
      environmentId: this.score.environmentId,
      event: item.event, time, duration: item.duration, offset
    });
    run.voices.add(voice);
    voice.done.then(() => run.voices.delete(voice));
  }

  restore(run) {
    if (!run.offset) return;
    const { events, cycleSeconds } = this.score;
    const cycle = Math.floor((run.offset + EPSILON) / cycleSeconds);
    // A legal gate spans at most one cycle. Only its original onset owns the event.
    for (let origin = Math.max(0, cycle - 1); origin <= cycle; origin++) {
      for (const item of events) {
        const offset = run.offset - (origin * cycleSeconds + item.at);
        if (offset > EPSILON && offset < item.duration - EPSILON && item.event.layer !== 'percussion') {
          this.schedule(run, item, run.clockStart, offset);
        }
      }
    }
  }

  pump(run) {
    const now = this.context.currentTime;
    const { events, cycleSeconds } = this.score;
    const timeOf = cursor => run.clockStart - run.offset + cursor.cycle * cycleSeconds + events[cursor.index].at;
    if (timeOf(run.cursor) < now - EPSILON) {
      // Timer throttling can miss a deadline. Skip expired onsets and preserve the audio-clock phase.
      run.cursor = cursorAt(this.score, this.elapsedAt(run) + .01);
    }
    while (timeOf(run.cursor) < now + AHEAD) {
      const cursor = run.cursor;
      this.schedule(run, events[cursor.index], timeOf(cursor));
      if (++cursor.index === events.length) { cursor.index = 0; cursor.cycle++; }
    }
  }

  tick() {
    if (!this.run || this.context.state !== 'running') return;
    try { this.pump(this.run); } catch (error) { this.fail(error); }
  }

  fail(error) {
    this.stop();
    this.silence();
    this.onError(error);
  }

  pause() {
    if (!this.run) return;
    this.elapsed = this.elapsedAt(this.run);
    this.state = 'paused';
    this.retireRun();
  }

  stop() {
    this.elapsed = 0;
    this.state = 'stopped';
    if (this.run) this.retireRun();
  }

  restart(score = this.score) {
    this.stop();
    this.play(score);
  }

  retireRun() {
    const run = this.run;
    this.run = null;
    this.timers.clearInterval(run.timer);
    this.clearRetired(false);
    this.retired = run;
    const now = this.context.currentTime;
    if (this.context.state !== 'running' || now <= run.clockStart) {
      this.clearRetired();
      return;
    }
    const gain = run.bus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.min(1, (now - run.clockStart) / FADE_IN), now);
    gain.linearRampToValueAtTime(0, now + FADE_OUT);
    for (const voice of run.voices) {
      if (voice.startTime > now) voice.cancel();
      else voice.release(now);
    }
    run.cleanup = this.timers.setTimeout(() => this.clearRetired(), 40);
  }

  clearRetired(detach = true) {
    const run = this.retired;
    if (run) {
      this.retired = null;
      this.timers.clearTimeout(run.cleanup);
      for (const voice of run.voices) voice.cancel();
      run.voices.clear();
      run.ambience?.dispose();
      run.creative?.dispose();
      run.bus.disconnect();
    }
    if (detach && !this.run && this.attached) {
      this.disconnect(this.master);
      this.attached = false;
    }
  }

  // Used before starting REMIX so even a pending CREATE fade cannot overlap it.
  silence() {
    if (this.run) this.stop();
    this.clearRetired();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.silence();
    this.context.removeEventListener('statechange', this.contextChanged);
    this.master.disconnect();
  }
}
