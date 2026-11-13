import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindQuickStart } from '../js/quick-start.js';

const html = readFileSync(new URL('../experience.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('help uses a named native dialog and a dedicated non-transport trigger and close control', () => {
  assert.match(html, /id="audio-mode"[^>]*>.*data-mode="remix".*data-mode="create".*id="quick-start-open" type="button" aria-haspopup="dialog" aria-controls="quick-start">Quick Tips<\/button><\/div>/);
  assert.equal((html.match(/aria-controls="quick-start"/g) ?? []).length, 1);
  assert.match(css, /#quick-start-open\{margin-left:auto/);
  assert.match(html, /<dialog id="quick-start" aria-labelledby="quick-start-title">/);
  assert.match(html, /<h2 id="quick-start-title">How it works<\/h2>/);
  assert.match(html, /<form method="dialog"><button id="quick-start-close" type="submit" aria-label="Close instructions" autofocus>×<\/button><\/form>/);
  const dialog = html.match(/<dialog id="quick-start"[\s\S]*?<\/dialog>/)[0];
  assert.equal((dialog.match(/<button\b/g) ?? []).length, 1);
});

test('all four tip sections use headings and lists with transport instructions', () => {
  const sections = [...html.matchAll(/<section>\s*<h3>(.*?)<\/h3>\s*<ul>([\s\S]*?)<\/ul>\s*<\/section>/g)];
  assert.deepEqual(sections.map(([, heading]) => heading), ['REMIX', 'CREATE', 'CONTROLS', 'PLAYBACK']);
  const lists = sections.map(([, , list]) =>
    [...list.matchAll(/<li>(.*?)<\/li>/g)].map(([, tip]) => tip.replace(/<\/?strong>/g, '')));
  assert.deepEqual(lists, [
    ['Select a soundtrack → Play.', 'Or upload your own audio → Play.',
      'Choose Processed to adjust the audio via Color, Distortion, Space and Energy controls.',
      'Choose Original to hear the recording without those effects.'],
    ['Choose an environment → Generate → Play.', 'Generate again to create a different song.'],
    ['Live: Changes the sound immediately in CREATE.', 'Next Generate: Adjust setting → Generate → Stop → Play.'],
    ['Play / Pause: Start or pause the music.', 'Resume: Continue where you paused.', 'Stop: Reset to the beginning.',
      'Restart: Play the same song from the start.']
  ]);
});

test('dialog styling includes a glass fallback, generous type and spacing, and a reduced-motion override', () => {
  assert.match(css, /#quick-start\{[^}]*max-height:[^;]+;[^}]*overflow:auto;[^}]*background:#101b21;[^}]*border-radius:18px;[^}]*box-shadow:/);
  assert.match(css, /@supports [^{]*backdrop-filter[^{]*\{\s*#quick-start\{background:#101b21a6;[^}]*backdrop-filter:blur\(12px\)/);
  assert.match(css, /\.quick-start-heading h2\{font-size:28px/);
  assert.match(css, /#quick-start section\{margin-top:18px\}/);
  assert.match(css, /#quick-start h3\{[^}]*font:600 22px\/1\.2/);
  assert.match(css, /#quick-start-close\{[^}]*width:44px;height:44px/);
  assert.match(css, /#quick-start-close:focus-visible/);
  assert.match(css, /#quick-start\[open\]\{animation:quick-start-enter 240ms ease-out both\}/);
  assert.match(css, /@keyframes quick-start-enter\{\s*from\{opacity:0;transform:translateY\(-8px\)\}\s*to\{opacity:1;transform:translateY\(0\)\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\s*#quick-start\[open\]\{animation:none\}/);
});

test('help activation is idempotent and focus returns on close without calling transport', () => {
  const trigger = new EventTarget();
  const dialog = new EventTarget();
  const calls = [];
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
    calls.push('showModal');
  };
  trigger.focus = options => calls.push(['focus', options]);
  bindQuickStart(trigger, dialog);
  trigger.dispatchEvent(new Event('click'));
  trigger.dispatchEvent(new Event('click'));
  assert.deepEqual(calls, ['showModal']);
  dialog.open = false;
  dialog.dispatchEvent(new Event('close'));
  assert.deepEqual(calls, ['showModal', ['focus', { preventScroll: true }]]);
  trigger.dispatchEvent(new Event('click'));
  assert.equal(dialog.open, true);
});



test('Quick Tips headings and the close icon use the same theme accent', () => {
  assert.match(css, /#quick-start h3\{[^}]*color:var\(--accent\)/);
  assert.match(css, /#quick-start-close\{[^}]*color:var\(--accent\)/);
});
