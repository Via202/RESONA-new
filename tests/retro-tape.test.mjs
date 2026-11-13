import test from 'node:test';
import assert from 'node:assert/strict';
import { languages } from '../js/languages.js';
import { environments } from '../js/environments.js';

function render(style, id, { reduced = false, level = .5, t = 3.29 } = {}) {
  const calls = [];
  const ctx = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) });
  languages[style]({ctx, w: 1000, h: 400, t, reduced, preset: environments[id],
    controls: { hueShift: 0, chaos: .4, distortion: .4 }, signal: { level, bass: .5, mid: .5, high: .5 },
    point: (x,y) => ({x,y}), ink: () => '#fff', baseHue: environments[id].hue});
  return calls;
}
const count = (calls, name) => calls.filter(([type]) => type === name).length;

test('tape rendering is confined to the Retro Soundwave frame and restores drawing state', () => {
  for (const id of Object.keys(environments).filter(id => id !== 'retro')) {
    assert.equal(count(render('glitch', id), 'clip'), 0);
  }
  assert.equal(count(render('geometric', 'retro'), 'clip'), 0);
  const active = render('glitch','retro');
  const still = render('glitch','retro',{reduced:true});
  const idle = render('glitch','retro',{level:0});
  const ordinary = render('glitch','retro',{t:1});
  for (const [calls, clips, strokes] of [[active,3,7],[still,1,5],[idle,1,5],[ordinary,2,6]]) {
    assert.equal(count(calls,'clip'), clips);
    assert.equal(count(calls,'stroke'), strokes);
    assert.deepEqual(calls.find(([op])=>op==='strokeRect').slice(1).map(Math.round), [90,56,820,276]);
    let depth = 0;
    for (const [op] of calls) {
      if(op==='save')depth++;
      if(op==='restore')assert.ok(--depth>=0);
      if(op==='fillRect'||op==='clip')assert.ok(depth>=2);
    }
    assert.equal(depth,0);
    assert.ok(count(calls,'fillRect')<=400);
  }
  assert.deepEqual(active.find(([op])=>op==='rect').slice(1).map(Math.round), [91,57,818,274]);
  assert.ok(count(still,'fillRect')<count(active,'fillRect'));
});

test('scanline phase moves the dense scanlines and reduced motion ignores it', async () => {
  const {drawTapeTexture}=await import('../js/retro-tape.js');
  function lines(reduced, phase) {
    const rows=[];
    const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},
      fillRect(x,y,width){if(width===820)rows.push([y,this.fillStyle]);}};
    drawTapeTexture(ctx,90,56,820,276,reduced,phase);
    return rows;
  }
  const active=lines(false,0), shifted=lines(false,1.8), reduced=lines(true,0);
  assert.equal(active[1][0]-active[0][0],3);
  assert.equal(active[0][1],'rgba(0,0,0,.085)');
  assert.ok(Math.abs(shifted[0][0]-active[0][0]-1.8)<.001);
  assert.ok(active.length>reduced.length);
  assert.deepEqual(lines(true,1.8),reduced);
});
