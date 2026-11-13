import { createCreativeMix } from './create/creative-mix.js';
import { scheduleInstrumentEvent } from './instruments/index.js';
import { createRemixEffects } from './remix-effects.js';

export const EXPORT_RATE = 44100;
const MAX_SECONDS = 420;
const MAX_BYTES = 96 * 1024 * 1024;
const BLOCK = 65536;

export function waveHeader(frames, channels, rate) {
  const header = new ArrayBuffer(44), view = new DataView(header);
  const tag = (offset, text) => {
    for (const [index, letter] of [...text].entries()) view.setUint8(offset + index, letter.charCodeAt(0));
  };
  const bytes = frames * channels * 2;
  tag(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, bytes, true);
  return header;
}

export function pcm16(sample) {
  const bounded = Math.max(-1, Math.min(1, sample));
  return Math.round(bounded * (bounded < 0 ? 32768 : 32767));
}

export function createExportEvents(score, leadIn) {
  const previous = score.events.flatMap(item => {
    const time = leadIn + item.at - score.cycleSeconds;
    const offset = Math.max(0, -time);
    if (time < 0 && (offset >= item.duration || item.event.layer === 'percussion')) return [];
    return [{ ...item, time: Math.max(0, time), offset }];
  });
  return [...previous, ...score.events.map(item => ({ ...item, time: leadIn + item.at, offset: 0 }))];
}

function contextFor(channels, frames) {
  const Context = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Context) throw new Error('Offline audio rendering is unavailable in this browser.');
  return new Context(channels, frames, EXPORT_RATE);
}

async function renderCreate({ score, controls, volume }) {
  const frames = Math.round(score.cycleSeconds * EXPORT_RATE);
  const leadIn = Math.min(8, frames / EXPORT_RATE);
  const start = Math.round(leadIn * EXPORT_RATE);
  const context = contextFor(2, start + frames);
  const output = context.createGain();
  output.gain.value = volume * .60;
  output.connect(context.destination);
  const mix = createCreativeMix(context, score.environmentId, output, controls);
  try {
    for (const { event, time, duration, offset } of createExportEvents(score, leadIn)) {
      scheduleInstrumentEvent({ context, output: mix.input(event.layer), environmentId: score.environmentId,
        event, time, duration, offset });
    }
    return { buffer: await context.startRendering(), start, frames };
  } finally {
    mix.dispose();
    output.disconnect();
  }
}

async function decode({ file, src, duration }) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Wait for the recording to finish loading.');
  if (duration > MAX_SECONDS) throw new Error('This recording exceeds the 7-minute export limit.');
  let bytes;
  if (file) {
    if (file.size > MAX_BYTES) throw new Error('This recording exceeds the 96 MiB source limit.');
    bytes = await file.arrayBuffer();
  } else {
    const url = new URL(src, document.baseURI);
    if (url.origin !== location.origin) throw new Error('Export requires a local file or a bundled soundtrack.');
    const response = await fetch(url, { mode: 'same-origin' });
    if (!response.ok) throw new Error('The soundtrack could not be loaded.');
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('The soundtrack is too large.');
    bytes = await response.arrayBuffer();
  }
  if (bytes.byteLength > MAX_BYTES) throw new Error('This recording exceeds the 96 MiB source limit.');
  const buffer = await contextFor(1, 1).decodeAudioData(bytes);
  if (buffer.duration > MAX_SECONDS || buffer.numberOfChannels > 2) {
    throw new Error('Export supports mono or stereo recordings up to 7 minutes.');
  }
  return buffer;
}

export async function renderExport(snapshot, status) {
  if (snapshot.mode === 'create') {
    status('Rendering audio…');
    return renderCreate(snapshot);
  }
  const decoded = await decode(snapshot);
  const frames = decoded.length;
  if (!snapshot.processed) return { buffer: decoded, frames, start: 0 };
  status('Rendering audio…');
  const context = contextFor(2, frames);
  const source = context.createBufferSource(), level = context.createGain();
  source.buffer = decoded;
  level.gain.value = snapshot.volume;
  const effects = createRemixEffects(context, context.destination, snapshot.controls, true, snapshot.environment);
  source.connect(level).connect(effects.input);
  try {
    source.start();
    return { buffer: await context.startRendering(), frames, start: 0 };
  } finally {
    source.disconnect();
    level.disconnect();
    effects.dispose();
  }
}

const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));

export async function encodeExport({ buffer, start, frames }, format, progress) {
  const count = buffer.numberOfChannels;
  const channels = Array.from({ length: count }, (_, index) => buffer.getChannelData(index));
  if (format === 'wav') {
    const parts = [waveHeader(frames, count, buffer.sampleRate)];
    for (let position = 0; position < frames; position += BLOCK) {
      const length = Math.min(BLOCK, frames - position);
      const block = new DataView(new ArrayBuffer(length * count * 2));
      for (let frame = 0; frame < length; frame++) {
        for (let channel = 0; channel < count; channel++) {
          block.setInt16((frame * count + channel) * 2, pcm16(channels[channel][start + position + frame]), true);
        }
      }
      parts.push(new Blob([block.buffer]));
      progress((position + length) / frames);
      await yieldFrame();
    }
    return new Blob(parts, { type: 'audio/wav' });
  }
  const worker = new Worker(new URL('./mp3-worker.js', import.meta.url));
  try {
    const send = (message, transfer = []) => new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data);
      worker.onerror = () => reject(new Error('The MP3 encoder could not run.'));
      worker.postMessage(message, transfer);
    });
    await send({ command: 'start', count, rate: buffer.sampleRate });
    for (let position = 0; position < frames; position += BLOCK) {
      const length = Math.min(BLOCK, frames - position);
      const block = channels.map(samples => {
        const pcm = new Int16Array(length);
        for (let i = 0; i < length; i++) pcm[i] = pcm16(samples[start + position + i]);
        return pcm;
      });
      await send({ command: 'encode', block }, block.map(pcm => pcm.buffer));
      progress((position + length) / frames);
    }
    return (await send({ command: 'finish' })).blob;
  } finally {
    worker.terminate();
  }
}
