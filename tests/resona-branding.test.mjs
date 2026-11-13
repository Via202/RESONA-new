import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('the homepage has one RESONA wordmark and a native entrance separate from navigation', () => {
  const html = read('index.html');
  const entry = html.match(/<a class="landing-entry" href="experience\.html" aria-labelledby="enter-label">([\s\S]*?)<\/a>/)?.[1];
  assert.ok(entry);
  assert.match(entry, /<h1 id="home-title">RESONA<\/h1>/);
  assert.match(entry, /id="enter-label">CLICK TO ENTER</);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /class="brand"|sculpture-scene|orb-ring|\bSTART\b/);
  assert.match(html, /<\/nav><\/header>\s*<main class="landing">/);
});

test('page titles and wordmarks use RESONA while export naming retains its existing prefix', () => {
  for (const page of ['index.html','experience.html','credits.html']) {
    const html = read(page);
    assert.match(html, /<title>RESONA/);
    assert.doesNotMatch(html, /SONIC(?:\s|<span>)?CHAOS/);
    if(page!=='index.html') assert.match(html, /class="brand" href="index\.html">RESONA<\/a>/);
  }
  const app = read('js/app.js');
  assert.match(app, /document\.title='RESONA — '\+preset\.name/);
  assert.ok(app.includes('name:`sonic-chaos-'));
  assert.ok(app.includes("name:'sonic-chaos-remix-"));
});
