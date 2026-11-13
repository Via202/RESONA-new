import { createRemixEffects } from './remix-effects.js';

// Pure band aggregation is shared by the analyser and the signal verification.
export function bandEnergy(data, sampleRate, fftSize, low, high) {
  const start = Math.max(1, Math.ceil(low * fftSize / sampleRate));
  const end = Math.min(data.length - 1, Math.floor(high * fftSize / sampleRate));
  let sum = 0;
  for (let i = start; i <= end; i++) sum += data[i] / 255;
  return end >= start ? sum / (end - start + 1) : 0;
}
export class AudioEngine {
  constructor(element) { this.element = element; this.external = new Set(); }
  async resume() {
    // Create exactly one media source, lazily inside the user's play gesture.
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is unavailable in this browser.');
      this.context = new Context();
      this.source = this.context.createMediaElementSource(this.element);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      this.source.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      this.frequency = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Float32Array(this.analyser.fftSize);
    }
    await this.context.resume();
    return this.context;
  }
  async start(isCurrent = () => true) {
    await this.resume();
    if (!isCurrent()) return;
    if (this.remixValues && !this.remixEffects) {
      const effects = createRemixEffects(this.context, this.analyser, this.remixValues, this.remixProcessed, this.remixEnvironment);
      try {
        this.source.disconnect(this.analyser);
        this.source.connect(effects.input);
        this.remixEffects = effects;
      } catch (error) {
        effects.dispose();
        this.source.connect(this.analyser);
        throw error;
      }
    }
    try {
      await this.element.play();
    } catch (error) {
      if (isCurrent()) this.clearRemix();
      throw error;
    }
  }
  setRemix(values, processed, environmentId) {
    this.remixValues = { ...values };
    this.remixProcessed = processed;
    this.remixEnvironment = environmentId;
    this.remixEffects?.update(this.remixValues, processed, environmentId);
  }
  clearRemix() {
    if (!this.remixEffects) return;
    this.source.disconnect(this.remixEffects.input);
    this.remixEffects.dispose();
    this.remixEffects = null;
    this.source.connect(this.analyser);
  }
  connectExternal(node) {
    if (!this.analyser) throw new Error('Resume the audio engine first.');
    if (this.external.has(node)) return;
    node.connect(this.analyser);
    this.external.add(node);
  }
  disconnectExternal(node) {
    if (this.external.delete(node)) node.disconnect(this.analyser);
  }
  get active() {
    return this.context?.state === 'running' && (!this.element.paused || this.external.size > 0);
  }
  sample() {
    const zero = { bass: 0, mid: 0, high: 0, level: 0 };
    if (!this.analyser || !this.active) return zero;
    this.analyser.getByteFrequencyData(this.frequency);
    this.analyser.getFloatTimeDomainData(this.wave);
    return {
      bass: bandEnergy(this.frequency,this.context.sampleRate,2048,30,250),
      mid: bandEnergy(this.frequency,this.context.sampleRate,2048,250,2000),
      high: bandEnergy(this.frequency,this.context.sampleRate,2048,2000,12000),
      level: Math.sqrt(this.wave.reduce((sum,n) => sum+n*n,0)/this.wave.length)
    };
  }
}
