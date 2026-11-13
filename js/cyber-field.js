export const modes = ['Particle', 'Dithering', 'ASCII'];
const duration = 2.6;
const fade = 0.4;
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function passAt(seconds, reduced) {
  if (reduced) return { mode: 0, blend: 0 };
  const phase = seconds % duration;
  const p = Math.max(0, (phase - duration + fade) / fade);
  return { mode: Math.floor(seconds / duration) % modes.length, blend: p * p * (3 - 2 * p) };
}

export function orderedPixel(x, y, brightness) {
  return brightness * 16 > bayer[(y % 4) * 4 + x % 4] + 0.5;
}

export function createField(count) {
  const field = new Float32Array(count * 5);
  const rings = Math.max(1, Math.round(Math.sqrt(count) * 0.927));
  let seed = 37753;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const latitude = Math.PI * ((i % rings) + 0.5) / rings;
    // Each prefix spans all latitudes and distributes meridians around the globe.
    const longitude = Math.floor(i / rings) * 2.399963229728653;
    const rim = Math.sin(latitude);
    const base = i * 5;
    field[base] = Math.cos(longitude) * rim;
    field[base + 1] = Math.cos(latitude);
    field[base + 2] = Math.sin(longitude) * rim;
    field[base + 3] = random() * 6.283;
    field[base + 4] = 0.25 + 0.75 * random();
  }
  return field;
}

const glyphs = '.:-=+*#%@';
const brightnessLevels = [22, 34, 48, 67, 87];

export function createParticleRenderer(canvas) {
  const context = canvas.getContext('2d');
  const field = createField(8600);
  const projected = new Float32Array(8600 * 3);
  let density = new Float32Array(0);
  let width = 0, height = 0, ratio = 0;
  let hue, shades, linkColor;
  const interference = Array.from({ length: 5 }, () => ({ start: 0, duration: 0 }));
  let glitchSeed = 912347, previousGlitchTime, quietGap = 5, burstEnd = 0;
  const nextGlitchValue = () =>
    ((glitchSeed = (Math.imul(glitchSeed, 1664525) + 1013904223) >>> 0) / 4294967296);

  function drawInterference(seconds, signal, reduced) {
    if (previousGlitchTime === undefined || seconds < previousGlitchTime || reduced) {
      previousGlitchTime = seconds;
      quietGap = 5;
      burstEnd = seconds;
      for (const fragment of interference) fragment.duration = 0;
      return;
    }
    const activity = Math.min(1, signal.level * 0.74 + signal.high * 0.4);
    const quietTime = Math.max(0, seconds - Math.max(previousGlitchTime, burstEnd));
    quietGap -= Math.min(0.1, quietTime) * (1 + activity * 6);
    previousGlitchTime = seconds;
    if (quietGap <= 0) {
      quietGap = 3.6 + nextGlitchValue() * 4.8;
      const count = activity > 0.62 ? 5 : activity > 0.34 ? 3 : activity > 0.12 ? 2 : 1;
      const clustered = count >= 3 && nextGlitchValue() < 0.68;
      const groupX = 0.25 + nextGlitchValue() * 0.37;
      const groupY = 0.21 + nextGlitchValue() * 0.58;
      for (let index = 0; index < count; index++) {
        const fragment = interference[index];
        fragment.start = seconds + index * 0.018 + nextGlitchValue() * 0.042;
        fragment.duration = 0.10 + nextGlitchValue() * 0.15;
        burstEnd = Math.max(burstEnd, fragment.start + fragment.duration);
        fragment.x = clustered ? groupX + (nextGlitchValue() - 0.5) * 0.13 : 0.08 + nextGlitchValue() * 0.72;
        fragment.y = clustered ? groupY + (index - (count - 1) / 2) * 0.018 : 0.1 + nextGlitchValue() * 0.8;
        fragment.length = 0.042 + nextGlitchValue() * (0.07 + activity * 0.075);
        fragment.thickness = activity > 0.57 && nextGlitchValue() > 0.76 ? 3 : activity > 0.16 ? 2 : 1;
        fragment.split = 0.37 + nextGlitchValue() * 0.23;
        fragment.gap = 0.11 + nextGlitchValue() * 0.17;
        fragment.speed = 74 + nextGlitchValue() * 68;
        fragment.phase = nextGlitchValue() * 6.28;
      }
    }
    for (const fragment of interference) {
      const age = seconds - fragment.start;
      if (age < 0 || age >= fragment.duration) continue;
      const flicker = Math.sin(age * fragment.speed + fragment.phase);
      if (flicker < -0.84) continue;
      const x = Math.max(4, fragment.x * width + Math.round(flicker * (3 + activity * 8)));
      const y = Math.round(fragment.y * height);
      const length = Math.min(fragment.length * width, width - x - 10);
      if (length < 6) continue;
      const tail = fragment.split + fragment.gap;
      const opacity = (0.22 + activity * 0.54) * (0.74 + flicker * 0.26)
        * Math.min(1, (fragment.duration - age) / 0.062);
      context.fillStyle = `hsla(${hue}, 61%, ${68 + activity * 12}%, ${opacity})`;
      context.fillRect(x, y, length * fragment.split, fragment.thickness);
      if (flicker > -0.48) {
        context.fillRect(x + length * tail, y + (flicker > 0.45 ? 2 : 0),
          length * (1 - tail), Math.max(1, fragment.thickness - 1));
      }
    }
  }

  function project(time, signal, pointer, pulse, pulseAge, count, reduced) {
    const angle = time * 0.16;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const motion = reduced ? 0.22 : 1;
    const expansion = 1 + signal.bass * 0.31 * motion;
    const swirl = signal.mid * (0.85 + signal.level * 0.95) * motion;
    const turbulence = Math.max(0, signal.level - 0.36) * 0.32 * motion;
    const jitter = signal.high * 0.05 * motion;
    const maximumRadius = expansion + turbulence + jitter;
    const projectedRadius = maximumRadius / Math.sqrt(1 - (maximumRadius * 0.16) ** 2);
    const verticalSpace = Math.max(0, height - (width > 650 ? 84 : 26));
    const scale = Math.min(verticalSpace * 0.36,
      (width - 26) * (width <= 650 ? 0.31 : 0.195),
      Math.min(width - 26, verticalSpace) * 0.48 / projectedRadius);
    const cursorX = pointer.x * width, cursorY = pointer.y * height;
    const scanX = (pulse?.x ?? 0) * width, scanY = (pulse?.y ?? 0) * height;
    const reach = scale * 0.46;
    for (let i = 0; i < count; i++) {
      const base = i * 5, out = i * 3;
      const phase = field[base + 3];
      const y = field[base + 1];
      const x = field[base], z = field[base + 2];
      let yawCos = cosine, yawSin = sine, radius = expansion;
      if (swirl > 0) {
        const yaw = angle + swirl * Math.sin(y * 4.6 - time * 2.5 + z * 2.2);
        yawCos = Math.cos(yaw);
        yawSin = Math.sin(yaw);
      }
      if (turbulence > 0) radius += turbulence * Math.sin(x * 7 + y * 8 - time * 4);
      if (jitter > 0) radius += jitter * Math.sin(phase + time * 20);
      const horizontal = (x * yawCos + z * yawSin) * radius;
      const rotatedZ = (z * yawCos - x * yawSin) * radius;
      // Tilt the polar axis to show both the rim and the latitude contours.
      const vertical = y * radius * 0.91 - rotatedZ * 0.415;
      const depth = rotatedZ * 0.91 + y * radius * 0.415;
      const perspective = 1 / (1 - depth * 0.16);
      let screenX = width / 2 + horizontal * scale * perspective;
      let screenY = height / 2 + vertical * scale * perspective;
      if (!reduced && pointer.strength > 0.005) {
        const dx = screenX - cursorX, dy = screenY - cursorY;
        const squared = dx * dx + dy * dy;
        const pull = Math.max(0, 1 - squared / (reach * reach)) * pointer.strength * 0.36;
        screenX -= dx * pull;
        screenY -= dy * pull;
      }
      if (!reduced && pulse) {
        const dx = screenX - scanX, dy = screenY - scanY;
        const distance = Math.hypot(dx, dy);
        const edge = Math.max(0, 1 - Math.abs(distance - pulseAge * reach * 2.3) / 23);
        const push = edge * (1 - pulseAge) * 18 / Math.max(distance, 1);
        screenX += dx * push;
        screenY += dy * push;
      }
      projected[out] = Math.max(12, Math.min(width - 12, screenX));
      projected[out + 1] = Math.max(12, Math.min(height - 12, screenY));
      projected[out + 2] = Math.max(0.07, Math.min(1,
        field[base + 4] * (0.48 + depth * 0.27 + signal.level * 0.74)
        + (jitter > 0 ? signal.high * 0.22 * (0.5 + 0.5 * Math.sin(phase * 4 + time * 7)) : 0)));
    }
  }

  function drawParticles(count) {
    for (let shade = 0; shade < shades.length; shade++) {
      context.fillStyle = shades[shade];
      context.beginPath();
      for (let i = 0; i < count * 3; i += 3) {
        const brightness = projected[i + 2];
        if (Math.min(4, Math.floor(brightness * 5)) !== shade) continue;
        const size = 0.72 + brightness * 1.55;
        context.rect(projected[i], projected[i + 1], size, size);
      }
      context.fill();
    }
    context.strokeStyle = linkColor;
    context.beginPath();
    for (let i = 3; i < count * 3; i += 39) {
      const dx = projected[i] - projected[i - 3];
      const dy = projected[i + 1] - projected[i - 2];
      if (dx * dx + dy * dy < 100) {
        context.moveTo(projected[i - 3], projected[i - 2]);
        context.lineTo(projected[i], projected[i + 1]);
      }
    }
    context.stroke();
  }

  function drawCells(mode, count) {
    const ascii = mode === 2;
    const cellWidth = ascii ? 7 : 4;
    const cellHeight = ascii ? 10 : 4;
    const columns = Math.ceil(width / cellWidth);
    const rows = Math.ceil(height / cellHeight);
    const cells = columns * rows;
    if (density.length < cells) density = new Float32Array(cells);
    density.fill(0, 0, cells);
    for (let i = 0; i < count * 3; i += 3) {
      const x = Math.floor(projected[i] / cellWidth), y = Math.floor(projected[i + 1] / cellHeight);
      if (x >= 0 && x < columns && y >= 0 && y < rows) density[y * columns + x] += projected[i + 2];
    }
    context.font = '10px monospace';
    context.textBaseline = 'top';
    for (let shade = 0; shade < shades.length; shade++) {
      context.fillStyle = shades[shade];
      for (let i = 0; i < cells; i++) {
        const strength = density[i];
        if (strength < 0.16) continue;
        const brightness = Math.min(1, Math.sqrt(strength) * (ascii ? 0.48 : 0.65));
        if (Math.min(4, Math.floor(brightness * 5)) !== shade) continue;
        const x = i % columns, y = Math.floor(i / columns);
        if (ascii) context.fillText(glyphs[Math.floor(brightness * 8)], x * cellWidth, y * cellHeight);
        else if (orderedPixel(x, y, brightness)) context.fillRect(x * cellWidth, y * cellHeight, 3, 3);
      }
    }
  }

  return {
    render(seconds, signal, pointer, now, pass, reduced, accentHue = 138, surface, leader) {
      const nextWidth = surface?.w ?? canvas.clientWidth;
      const nextHeight = surface?.h ?? canvas.clientHeight;
      const nextRatio = Math.min(globalThis.devicePixelRatio || 1, 1.5);
      if (nextWidth < 26 || nextHeight < 26) return 0;
      if (nextWidth !== width || nextHeight !== height || nextRatio !== ratio) {
        width = nextWidth;
        height = nextHeight;
        ratio = nextRatio;
        if (!surface) {
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round(height * ratio);
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
        }
      }
      if (hue !== accentHue) {
        hue = accentHue;
        shades = brightnessLevels.map(light => `hsl(${hue}, 61%, ${light}%)`);
        linkColor = `hsla(${hue}, 61%, 68%, .18)`;
      }
      const count = width < 530 ? 4200 : width < 820 ? 6400 : 8600;
      const pulse = pointer.pulses.at(-1);
      const pulseAge = pulse ? Math.max(0, Math.min(1, (now - pulse.time) / pulse.lifetime)) : 0;
      project(reduced ? 0 : seconds, signal, pointer, pulse, pulseAge, count, reduced);
      context.fillStyle = '#050706';
      context.fillRect(0, 0, width, height);
      context.save();
      context.globalAlpha = 1 - pass.blend;
      if (pass.mode === 0) drawParticles(count);
      else drawCells(pass.mode, count);
      if (pass.blend > 0) {
        context.globalAlpha = pass.blend;
        context.globalCompositeOperation = 'lighter';
        const next = (pass.mode + 1) % modes.length;
        if (next === 0) drawParticles(count);
        else drawCells(next, count);
      }
      context.restore();
      if (leader && !reduced) {
        const target = (leader.right ? 151 : 96) * 3;
        const x = projected[target], y = projected[target + 1];
        const originX = leader.x * width, originY = leader.y * height;
        context.strokeStyle = linkColor;
        context.beginPath();
        context.moveTo(originX, originY);
        context.lineTo((originX + x) / 2, originY);
        context.lineTo(x, y);
        context.stroke();
        context.fillStyle = shades[3];
        context.fillRect(x - 1, y - 1, 3, 3);
      }
      if (pulse) {
        context.beginPath();
        context.arc(pulse.x * width, pulse.y * height, reduced ? 13 : 8 + pulseAge * 105, 0, Math.PI * 2);
        context.strokeStyle = `hsla(${hue}, 61%, 68%, ${(1 - pulseAge) * 0.52})`;
        context.stroke();
      }
      drawInterference(seconds, signal, reduced);
      return count;
    }
  };
}
