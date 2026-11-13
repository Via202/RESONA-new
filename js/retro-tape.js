const grain = Array.from({ length: 240 }, (_, index) => {
  const x = Math.sin((index + 1) * 127.1) * 43758.5453;
  const y = Math.sin((index + 1) * 311.7) * 43758.5453;
  return [x - Math.floor(x), y - Math.floor(y)];
});

function clipInterior(ctx, left, top, width, height) {
  ctx.beginPath();
  ctx.rect(left + 1, top + 1, width - 2, height - 2);
  ctx.clip();
}

export function drawTapeTexture(ctx, left, top, width, height, reduced, phase = 0) {
  if (width <= 2 || height <= 2) return;
  ctx.save();
  clipInterior(ctx, left, top, width, height);
  ctx.fillStyle = reduced ? 'rgba(0,0,0,.045)' : 'rgba(0,0,0,.085)';
  const spacing = Math.max(reduced ? 4 : 3, height / 256);
  for (let y = reduced ? 0 : phase * spacing / 3; y < height; y += spacing) {
    ctx.fillRect(left, top + y, width, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,.075)';
  for (let i = 0; i < grain.length; i += reduced ? 2 : 1) {
    const [x, y] = grain[i];
    ctx.fillRect(left + x * width, top + y * height, 1, 1);
  }
  ctx.restore();
}

export function drawTapeEcho(ctx, points, left, top, width, height, hue, t, level) {
  if (width <= 2 || height <= 2) return;
  ctx.save();
  clipInterior(ctx, left, top, width, height);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `hsla(${hue},94%,75%,${.075 + level * .055})`;
  ctx.lineWidth = 1;
  const trace = offset => {
    ctx.beginPath();
    ctx.moveTo(points[0] + offset, points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i] + offset, points[i + 1]);
    ctx.stroke();
  };
  trace(1.5 + Math.sin(t * .8) * .45);

  // One brief, eased tracking echo per cycle, in a different narrow band each time.
  const cycle = Math.floor(t / 8);
  const phase = (t % 8 - 3.2) / .18;
  if (phase > 0 && phase < 1 && level > .08) {
    const band = top + height * (.34 + (cycle % 5) * .065);
    ctx.beginPath();
    ctx.rect(left + 1, band, width - 2, 7);
    ctx.clip();
    const strength = Math.sin(phase * Math.PI);
    ctx.strokeStyle = `hsla(${hue},94%,75%,${.16 * strength})`;
    trace((cycle % 2 ? -1 : 1) * 4 * strength);
  }
  ctx.restore();
}
