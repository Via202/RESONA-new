import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { environments } from '../js/environments.js';

test('every built-in soundtrack resolves to the supplied MP3 with the intended title', () => {
  const dir = new URL('../assets/audio/', import.meta.url);
  const files = readdirSync(dir);
  const tracks = [
    ['underwater','deleradmix.mp3','Del Erad'],
    ['dreamcore','A Lucid Dream.mp3','A Lucid Dream'],
    ['space','Drifting Beyond the Stars.mp3','Drifting Beyond the Stars'],
    ['retro','a_short_walk_with_you.mp3','A Short Walk With You'],
    ['cyberpunk','synth_type_mix-low-pridox.mp3','synthwave type remixed — Low Pridox mix']
  ];
  for (const [id, file, title] of tracks) {
    assert.ok(files.includes(file));
    assert.equal(environments[id].track, 'assets/audio/'+file);
    assert.equal(environments[id].title, title);
  }
  assert.ok(readFileSync(new URL('../experience.html',import.meta.url),'utf8').includes('src="'+environments.underwater.track+'"'));
});

test('credits link to all five sources and credit Retro under CC BY 4.0', () => {
  const html = readFileSync(new URL('../credits.html',import.meta.url),'utf8');
  for (const id of ['del-erad-janne-hanhisuanto-maou-tricksntraps','a-lucid-dream','drifting-beyond-the-stars-background-ambient','purrple-cat-up-all-night-lofi-album','synthwave-type-remixed-gp-vs-vitalezzz-vs-tricksntraps-vs-zodik']) {
    assert.ok(html.includes('href="https://opengameart.org/content/'+id+'"'));
  }
  for (const license of ['by/3.0','by/4.0','by-sa/4.0']) assert.ok(html.includes('creativecommons.org/licenses/'+license+'/'));
  const retro = html.match(/>Lo-fi Retro<\/span><h3>A Short Walk With You<\/h3>([\s\S]*?)<\/div>/)?.[1];
  assert.match(retro, /Purrple Cat<\/a>, from <em>Up All Night<\/em>/);
  assert.match(retro, /href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/">CC BY 4\.0<\/a>/);
  assert.doesNotMatch(retro, /pending confirmation|CC BY-SA/);
});
