import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { controlDefaults, CreativeControls, generationSettings } from '../js/create/controls.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('visual language keeps four native toggle buttons in a two-column grid', () => {
  const html = read('../experience.html');
  const css = read('../styles.css');
  const choices = html.match(/id="styles"[^>]*>(.*?)<\/div>/s)[1];
  assert.deepEqual([...choices.matchAll(/<button data-style="([^"]+)" aria-pressed="([^"]+)"/g)]
    .map(([, id, state]) => [id, state]), [
    ['liquid', 'true'], ['geometric', 'false'], ['glitch', 'false'], ['dreamlike', 'false']
  ]);
  assert.match(css, /\.style-options\{[^}]*display:grid;grid-template-columns:repeat\(2,/);
  assert.match(read('../js/app.js'), /\$\('styles'\)\.addEventListener\('click'/);
});

test('analysis has an explicit desktop center column and shared sliders precede CREATE-only sliders', () => {
  const html = read('../experience.html');
  const css = read('../styles.css');
  assert.match(css, /\.lower\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.lower\{grid-template-columns:minmax\(0,1fr\) minmax\(0,400px\) minmax\(0,1fr\)/);
  assert.match(css, /\.lower \.analysis\{grid-column:2;text-align:center\}/);
  assert.match(html, /class="mode-actions">\s*<div id="remix-comparison"[\s\S]*?<div id="create-controls"/);
  const order = [...html.matchAll(/<input id="([^"]+)" data-(?:parameter|creative)=/g)].map(match => match[1]);
  assert.deepEqual(order, ['chaos','speed','distortion','color','energy','space','density','melody']);
});

test('all eight hints retain accessible structured labels and reset does not reserve visible status space', () => {
  const html = read('../experience.html');
  const app = read('../js/app.js');
  const hints = {
    chaos: ['Next Generate', 'Musical variation'], speed: ['Next Generate', '76 BPM'],
    distortion: ['Live', 'Audio saturation'], color: ['Live', 'Tonal brightness'],
    energy: ['Live', 'Layer intensity'], density: ['Next Generate', 'Arrangement detail'],
    melody: ['Live', 'Lead volume (0 mutes)'], space: ['Live', 'Room depth']
  };
  for (const [id, [timing, detail]] of Object.entries(hints)) {
    assert.ok(html.includes(`aria-describedby="${id}-hint"`));
    assert.ok(html.includes(`id="${id}-hint" class="parameter-hint"><span>${timing}</span><span>${detail}</span>`));
  }
  assert.match(html, /id="reset-creative"[^>]*>Reset to default settings<\/button>/);
  assert.match(html, /id="control-status"[^>]* hidden><\/p>/);
  const reset = app.match(/\$\('reset-creative'\)[\s\S]*?\n\}\);/)[0];
  assert.match(reset, /creative\.reset\(\)/);
  assert.match(reset, /\$\('control-status'\)\.hidden=true/);
  assert.doesNotMatch(reset, /controls reset\./);
  assert.match(app, /generationSettings\(environment,creative\.draft\)\.tempo\} BPM/);
  const controls = new CreativeControls('retro');
  controls.set('speed', 100);
  assert.equal(generationSettings('retro', controls.draft).tempo, 114);
  controls.reset();
  assert.deepEqual(controls.draft, controlDefaults.retro);
  assert.equal(generationSettings('retro', controls.draft).tempo, 88);
});
