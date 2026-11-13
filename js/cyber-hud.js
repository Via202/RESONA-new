import { createParticleRenderer, modes, passAt } from './cyber-field.js';
import { visualParameters } from './parameters.js';

const clamp = value => Math.max(0, Math.min(1, value));
const construct = 0.7, retract = 0.85;
const audioKnees = { bass: 0.14, mid: 0.085, high: 0.022, level: 0.027 };

// Normalise only the Cyberpunk visual envelope. A quiet RMS gate rejects
// stale FFT values while playback is silent or suspended.
export function updateCyberAudio(envelope, signal, live, elapsed) {
  const gate = live ? clamp((signal.level - 0.0005) / 0.003) : 0;
  for (const key in audioKnees) {
    const value = Math.max(0, signal[key]);
    const target = gate * value / (value + audioKnees[key]);
    const timeConstant = target > envelope[key] ? 65 : 270;
    const amount = 1 - Math.exp(-Math.max(0, elapsed) / timeConstant);
    envelope[key] += (target - envelope[key]) * amount;
    if (target === 0 && envelope[key] < 0.0001) envelope[key] = 0;
  }
}

export function createFrameCycle(index) {
  return { start: index * 1.15, hold: 4 + index * 0.8, seed: (index + 1) * 7253, appearance: 0 };
}

export function framePhase(cycle, seconds, reduced) {
  if (reduced) return { trace: 1, info: 1, anchor: 0 };
  let age = seconds - cycle.start;
  if (age >= construct + cycle.hold + retract) {
    cycle.seed = (Math.imul(cycle.seed, 1664525) + 1013904223) >>> 0;
    cycle.start = Math.max(seconds, cycle.start + construct + cycle.hold + retract)
      + 2 + 3 * (cycle.seed / 4294967296);
    cycle.seed = (Math.imul(cycle.seed, 1664525) + 1013904223) >>> 0;
    cycle.hold = 4 + 3 * (cycle.seed / 4294967296);
    cycle.appearance++;
    age = seconds - cycle.start;
  }
  if (age < 0) return { trace: 0, info: 0, anchor: 0 };
  const end = age - construct - cycle.hold;
  return {
    trace: clamp((age - 0.18) / (construct - 0.18)) * (1 - clamp((end - 0.23) / 0.62)),
    info: clamp((age - construct) / 0.3) * (1 - clamp(end / 0.27)),
    anchor: clamp(age / 0.15) * (1 - clamp((age - 0.34) / 0.32)) + clamp((end - 0.48) / 0.37) * (1 - clamp((end - 0.72) / 0.13))
  };
}

export function createCyberHud(root, canvas, stage) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const status = root.querySelector('[data-hud-status]');
  const countLabel = root.querySelector('[data-hud-count]');
  const passLabel = root.querySelector('[data-hud-pass]');
  const scan = root.querySelector('[data-hud-scan]');
  const lines = [...root.querySelectorAll('[data-hud-log]')];
  const panels = [...root.querySelectorAll('.hud-frame')];
  const toggle = root.querySelector('[data-hud-view]');
  const bands = ['bass', 'mid', 'high'];
  const meters = [...root.querySelectorAll('meter')];
  const envelope = { bass: 0, mid: 0, high: 0, level: 0 };
  let field, start, previous, lastHud = -Infinity;
  let cycles, seconds = 0, pass, count = 0, hue, leader, particleView = true;
  const showParticles = visible => {
    particleView = visible;
    toggle.textContent = visible ? 'Live style view' : 'Particle field view';
    toggle.setAttribute('aria-pressed', String(!visible));
    canvas.setAttribute('aria-label', visible ? 'Interactive orbital particle sculpture' : 'Live audio visualizer');
  };
  toggle.addEventListener('click', () => showParticles(!particleView));

  return {
    showStyle() { if (!root.hidden) showParticles(false); },
    isParticleView() { return particleView; },
    show(visible) {
      root.hidden = !visible;
      stage.hidden = visible;
      if (!visible) {
        if (canvas.parentNode !== stage) stage.prepend(canvas);
        canvas.removeAttribute('aria-label');
      }
      if (visible) {
        root.prepend(canvas);
        showParticles(true);
        field ??= createParticleRenderer(canvas);
        cycles = panels.map((_, index) => createFrameCycle(index));
        leader = null;
        count = 0;
        start = undefined;
        previous = undefined;
        lastHud = -Infinity;
        for (const key of Object.keys(envelope)) envelope[key] = 0;
      }
    },
    render(surface, time) {
      count = field.render(seconds, envelope, surface.pointer, time, pass, motion.matches, hue, surface, leader);
    },
    frame(time, signal, live, audioError, parameters) {
      start ??= time;
      seconds = (time - start) / 1000;
      const step = Math.min(100, time - (previous ?? time));
      previous = time;
      updateCyberAudio(envelope, signal, live, step);
      const reduced = motion.matches;
      pass = passAt(seconds, reduced);
      const accent = 138 + visualParameters(parameters).hueShift;
      if (hue !== accent) {
        hue = accent;
        document.body.style.setProperty('--cyber-hue', hue);
      }
      if (time - lastHud < 80) return;
      lastHud = time;

      const input = live ? 'LIVE' : audioError ? 'NO TRACK' : 'STANDBY';
      status.textContent = input;
      countLabel.textContent = particleView ? String(count).padStart(5, '0') : '—';
      passLabel.textContent = particleView ? modes[pass.mode].toUpperCase() : 'LIVE STYLE';
      scan.value = reduced ? 0 : (seconds % 2.6) / 2.6;
      for (let i = 0; i < bands.length; i++) meters[i].value = signal[bands[i]];
      const messages = [
        ['FIELD / TRACKING', 'DEPTH / SPHERE', 'MOTION / ' + (envelope.level > 0.08 ? 'REACTIVE' : 'IDLE')],
        ['INPUT / ' + input, 'RMS / ' + Math.round(signal.level * 100) + '%', 'ANALYSER / ' + (live ? 'SAMPLING' : 'IDLE')],
        ['PASS / ' + passLabel.textContent, 'POINTS / ' + countLabel.textContent, 'COMPOSITE / ' + (pass.blend && particleView ? 'BLENDING' : 'STABLE')]
      ];
      leader = null;
      for (let i = 0; i < lines.length; i++) {
        const phase = framePhase(cycles[i], seconds, reduced);
        const panel = panels[i];
        panel.style.setProperty('--trace', phase.trace);
        panel.style.setProperty('--info', phase.info);
        panel.style.setProperty('--anchor', phase.anchor);
        panel.style.visibility = phase.trace || phase.info || phase.anchor ? 'visible' : 'hidden';
        if (!leader && phase.info > 0.95 && !reduced && cycles[i].appearance % 2 === 0
            && seconds - cycles[i].start < 2.5 && canvas.clientWidth > 650 && panel.offsetWidth) {
          const box = panel.getBoundingClientRect();
          const viewport = canvas.getBoundingClientRect();
          leader = { x: ((i ? box.left : box.right) - viewport.left) / viewport.width,
            y: (box.top + box.height / 2 - viewport.top) / viewport.height, right: i > 0 };
        }
        const clock = seconds + i * 1.13;
        const index = Math.floor(clock / 3.4) % messages[i].length;
        const message = messages[i][reduced ? 0 : index];
        const text = reduced ? message : message.slice(0, 1 + Math.floor((clock % 3.4) * 17));
        if (lines[i].textContent !== text) lines[i].textContent = text;
      }
    }
  };
}
