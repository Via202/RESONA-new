import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { environments } from '../js/environments.js';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('all three pages share header navigation and the requested font links', () => {
  for (const [page, label] of [['index.html','Home'], ['experience.html','Experience'], ['credits.html','Credits']]) {
    const html = read(page);
    const head = html.split('</head>')[0];
    assert.match(head, /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
    assert.match(head, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
    assert.ok(head.includes('family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&display=swap'));
    assert.match(html, /<header class="site-header">/);
    assert.deepEqual([...html.match(/<nav class="site-nav".*?<\/nav>/)[0].matchAll(/>(Home|Experience|Credits)<\/a>/g)].map(m => m[1]), ['Home','Experience','Credits']);
    assert.ok(html.includes('aria-current="page">'+label));
  }
  assert.match(read('index.html'), /class="headphone-note"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>Use headphones for best experience/);
});

test('caption metadata supplies one pair of quotes and agrees with the initial canvas', () => {
  for (const id of ['underwater','dreamcore','space','retro']) assert.match(environments[id].caption, /^"[^"]+"$/);
  assert.match(environments.cyberpunk.caption, /^“[^”]+”$/);
  assert.ok(read('experience.html').includes(environments.underwater.caption.replaceAll('"', '&quot;')));
});

test('comparison and export share an accent-derived surface and credits retain encoder attribution', () => {
  const css = read('styles.css');
  assert.match(css, /--format-surface: color-mix\(in srgb, var\(--accent\) 5%, #10171d\)/);
  assert.match(css, /\.export-card, \.remix-comparison select \{ background: var\(--format-surface\); \}/);
  const credits = read('credits.html');
  for (const wording of ['generate original procedural compositions', 'transform built-in and uploaded tracks', 'WAV and 320 kbps MP3 export', 'Roboto Condensed', 'LGPL-3.0.txt', 'lamejs-1.2.1.tgz']) assert.ok(credits.includes(wording), wording);
  assert.doesNotMatch(credits, /placeholder file paths|AUDIO NOT YET SUPPLIED/);
});
