import test from 'node:test';
import assert from 'node:assert/strict';
import { environments } from '../js/environments.js';
import { languages } from '../js/languages.js';
import { visualParameters } from '../js/parameters.js';

test('Soundwave applies the shared base hue to all layers without changing geometry', () => {
  const strokes = [];
  const ctx = {
    save() {}, restore() {}, rect() {}, clip() {}, fillRect() {},
    strokeRect(...box) { strokes.push({ box, color: this.strokeStyle, width: this.lineWidth }); },
    beginPath() { this.points = []; },
    moveTo(x, y) { this.points.push([x, y]); },
    lineTo(x, y) { this.points.push([x, y]); },
    stroke() { strokes.push({ color: this.strokeStyle, width: this.lineWidth, points: this.points }); }
  };
  const frame = {
    ctx, w: 1000, h: 400, t: 1, controls: { hueShift: 0, chaos: .4, distortion: .4 },
    signal: { bass: .7, mid: .5, high: .3, level: .6 },
    point: (x, y) => ({ x, y }), reduced: false
  };
  const hue = color => Number(/^hsla\(([^,]+)/.exec(color)[1]);
  let original;
  for (const color of [0, 17, 33, 49, 50, 51, 61, 84, 100]) {
    const controls = visualParameters({ color, chaos: 40, distortion: 40, speed: 50 });
    for (const preset of [...Object.values(environments), environments.underwater]) {
      strokes.length = 0;
      const primary = preset.hue + controls.hueShift;
      languages.glitch({ ...frame, controls, preset, baseHue: primary });
      const [border, ...waves] = strokes.slice(0, 6);
      const expectedHues = [42, 0, 42, 0, 42, 0].map(offset => primary + offset);
      [border, ...waves].forEach((stroke, index) => {
        assert.ok(Math.abs(hue(stroke.color) - expectedHues[index]) < 1e-9);
      });
      assert.ok(Math.abs(hue(ctx.shadowColor) - primary) < 1e-9);
      assert.ok(border.width < waves.at(-1).width);
      assert.deepEqual(border.box.map(Math.round), [90, 56, 820, 276]);
      const geometry = waves.map(({ points, width }) => ({ points, width }));
      original ??= geometry;
      assert.deepEqual(geometry, original);
      if (preset.id === 'retro') {
        assert.equal(strokes.length, 7);
        assert.ok(Math.abs(hue(strokes.at(-1).color) - (primary + 42)) < 1e-9);
      }
    }
  }
});
