import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { encodeExport, createExportEvents, EXPORT_RATE } from '../js/audio-export.js';
import { bindExportControls } from '../js/export-controls.js';
import { generateComposition } from '../js/composition/planner.js';
import { prepareScore } from '../js/create/score.js';

const read = name => readFileSync(new URL(name, import.meta.url));
const vendor = '../vendor/lamejs-1.2.1/';

test('the two export cards use native buttons and one accessible status', () => {
  const html = read('../experience.html').toString();
  const section = html.match(/<section class="audio-export"[\s\S]*?<\/section>/)[0];
  assert.equal((section.match(/<button /g) ?? []).length, 2);
  assert.match(section, /id="export-wav" type="button"[^>]*><strong>WAV<\/strong><small>LOSSLESS/);
  assert.match(section, /id="export-mp3" type="button"[^>]*><strong>MP3<\/strong><small>320 KBPS/);
  assert.match(section, /id="export-status" role="status"/);
});

test('WAV encodes an exact stereo slice as RIFF PCM16', async () => {
  const samples = [Float32Array.of(.3, -1, .5, 0), Float32Array.of(.1, 1, -.5, 0)];
  const buffer = { sampleRate: EXPORT_RATE, numberOfChannels: 2, getChannelData: i => samples[i] };
  const blob = await encodeExport({ buffer, start: 1, frames: 2 }, 'wav', () => {});
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(blob.type, 'audio/wav');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(bytes.readUInt32LE(4), bytes.length - 8);
  assert.equal(bytes.readUInt16LE(20), 1);
  assert.equal(bytes.readUInt16LE(22), 2);
  assert.equal(bytes.readUInt32LE(24), EXPORT_RATE);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(bytes.readUInt32LE(40), 8);
  assert.deepEqual([44, 46, 48, 50].map(offset => bytes.readInt16LE(offset)), [-32768, 32767, 16384, -16384]);
});

test('CREATE export retains score timing and schedules the previous carry exactly once', () => {
  const score = prepareScore(generateComposition({ environmentId: 'space', seed: 19 }));
  const plan = createExportEvents(score, 8);
  const preceding = plan.filter(event => event.time < 8);
  const cycle = plan.filter(event => event.time >= 8);
  assert.equal(cycle.length, score.events.length);
  assert.deepEqual(cycle.map(event => event.event), score.events.map(event => event.event));
  assert.deepEqual(new Set(cycle.map(event => event.event.layer)), new Set(['chords','bass','percussion','melody']));
  assert.equal(preceding.filter(event => event.event.carryTicks).length, 1);
  const carry = preceding.find(event => event.event.carryTicks);
  assert.ok(carry.time + carry.duration > 8);
  assert.equal(Math.round(score.cycleSeconds * EXPORT_RATE), Math.round(128 * 60 / score.tempo * EXPORT_RATE));
});

test('official worker output contains only 320 kbps MPEG-1 Layer III frames in mono and stereo', async () => {
  const integrity = createHash('sha512').update(read(vendor + 'lamejs-1.2.1.tgz')).digest('base64');
  assert.equal(integrity, 's7bxvjvYthw6oPLCm5pFxvA84wUROODB8jEO2+CE1adhKgrIvVOlmMgY8zyugxGrvRaDHNJanOiS21/emty6dQ==');
  const bundle = read(vendor + 'lame.min.js');
  assert.equal(createHash('sha256').update(bundle).digest('hex'), '15d285e2587b3bdbfd18a68de6ce07cc074f7480a82c3815da2dc1c348ec6df4');
  for (const count of [1, 2]) {
    let response;
    const scope = { Blob, Int16Array, self: { postMessage: data => { response = data; } } };
    scope.importScripts = () => runInNewContext(bundle.toString(), scope);
    runInNewContext(read('../js/mp3-worker.js').toString(), scope);
    const send = data => {
      scope.self.onmessage({ data });
      assert.equal(response.error, undefined);
      return response;
    };
    send({ command: 'start', count, rate: EXPORT_RATE });
    const block = Array.from({ length: count }, (_, channel) => Int16Array.from(
      { length: EXPORT_RATE }, (_, i) => 8000 * Math.sin(i / EXPORT_RATE * 2 * Math.PI * (330 + channel * 220))));
    send({ command: 'encode', block });
    const { blob } = send({ command: 'finish' });
    assert.equal(blob.type, 'audio/mpeg');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let cursor = 0, frames = 0;
    while (cursor < bytes.length) {
      assert.equal(bytes[cursor], 0xff);
      assert.equal(bytes[cursor + 1] & 0xfe, 0xfa);
      assert.equal(bytes[cursor + 2] >> 4, 14);
      assert.equal((bytes[cursor + 2] >> 2) & 3, 0);
      assert.equal((bytes[cursor + 3] >> 6) === 3, count === 1);
      cursor += Math.floor(144 * 320000 / EXPORT_RATE) + ((bytes[cursor + 2] >> 1) & 1);
      frames++;
    }
    assert.equal(cursor, bytes.length);
    assert.ok(Math.abs(frames * 1152 / EXPORT_RATE - 1) < .08);
  }
});

test('export prevents concurrent requests and a failed MP3 still allows one WAV download', async () => {
  const wav = new EventTarget(), mp3 = new EventTarget(), status = {};
  let requests = 0, clicks = 0;
  const download = { removeAttribute() { delete this.href; }, click() { clicks++; } };
  const clear = bindExportControls({ wav, mp3, status, download,
    snapshot() { requests++; return { name: 'test' }; },
    render: async () => ({}),
    encode: async (_, format) => {
      if (format === 'mp3') throw new Error('encoder failure');
      return new Blob(['test'], { type: 'audio/wav' });
    }
  });
  const settle = async () => {
    for (let i = 0; wav.disabled && i < 20; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(wav.disabled, false);
    assert.equal(mp3.disabled, false);
  };
  mp3.dispatchEvent(new Event('click'));
  assert.equal(wav.disabled, true);
  assert.equal(mp3.disabled, true);
  wav.dispatchEvent(new Event('click'));
  await settle();
  assert.equal(requests, 1);
  assert.equal(clicks, 0);
  assert.match(status.textContent, /encoder failure/);
  wav.dispatchEvent(new Event('click'));
  await settle();
  assert.equal(clicks, 1);
  assert.equal(download.download, 'test.wav');
  clear();
  assert.equal(download.hidden, true);
  assert.equal(download.href, undefined);
});
