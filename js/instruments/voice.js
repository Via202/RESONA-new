export function midiToFrequency(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError('Expected MIDI pitch 0–127.');
  return 440 * 2 ** ((midi - 69) / 12);
}

export function validateVoice(context, output, time, duration, velocity) {
  if (!context || typeof context.createGain !== 'function' || !Number.isFinite(context.currentTime) ||
      !Number.isFinite(context.sampleRate) || context.sampleRate <= 0 || !output || output.context !== context) {
    throw new TypeError('Supply a Web Audio context and an output node from that context.');
  }
  if (context.state === 'closed' || output === context.destination) {
    throw new TypeError('Supply an open context and an intermediate output node.');
  }
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(duration) || duration <= 0 ||
      duration > 300 || !Number.isFinite(velocity) || velocity < 0 || velocity > 1) {
    throw new RangeError('Expected nonnegative audio time, duration in (0, 300] seconds, and velocity in [0, 1].');
  }
}

// Voice-local graph ownership. The output and context belong to the caller.
export function createVoice({ context, output, time, duration, velocity, offset = 0, envelope, build }) {
  validateVoice(context, output, time, duration, velocity);
  const startTime = Math.max(time, context.currentTime);
  const originalStart = startTime - offset;
  const gateEnd = startTime + (duration - offset);
  if (gateEnd <= startTime || gateEnd + envelope.release <= gateEnd) {
    throw new RangeError('Voice timing cannot be represented on the audio clock.');
  }
  const attackEnd = originalStart + Math.min(envelope.attack, duration);
  const decayEnd = Math.min(gateEnd, attackEnd + envelope.decay);
  const peak = envelope.gain * velocity;
  const sustain = peak * envelope.sustain;
  const original = [[originalStart, 0], [attackEnd, peak]];
  if (decayEnd > attackEnd) {
    const progress = (decayEnd - attackEnd) / envelope.decay;
    original.push([decayEnd, peak + (sustain - peak) * progress]);
  }
  if (gateEnd > decayEnd) original.push([gateEnd, original.at(-1)[1]]);
  const points = offset === 0 ? original :
    [[startTime, envelopeValue(original, startTime)], ...original.filter(([at]) => at > startTime)];
  let endsAt = gateEnd + envelope.release;
  let releaseAt = gateEnd;
  let finished = false;
  let outcome = 'ended';
  let resolve;
  const done = new Promise(finish => { resolve = finish; });
  const nodes = [];
  const sources = [];
  const started = [];
  const own = node => { nodes.push(node); return node; };
  const source = node => { sources.push(node); return own(node); };

  function finish() {
    if (finished) return;
    finished = true;
    for (const node of sources) node.onended = null;
    for (const node of nodes) node.disconnect();
    sources.length = started.length = nodes.length = 0;
    amplitude = null;
    resolve(outcome);
  }

  function stopStarted(at) {
    for (const node of started) {
      // A source may already have ended while its event is waiting to be delivered.
      try { node.stop(at); } catch (error) {
        if (error.name !== 'InvalidStateError') throw error;
      }
    }
  }

  let amplitude;
  try {
    const gain = own(context.createGain());
    amplitude = gain.gain;
    amplitude.setValueAtTime(points[0][1], startTime);
    for (const [at, value] of points.slice(1)) amplitude.linearRampToValueAtTime(value, at);
    amplitude.linearRampToValueAtTime(0, endsAt);
    build({ own, source, target: gain, startTime, gateEnd });
    gain.connect(output);
    let remaining = sources.length;
    for (const node of sources) {
      node.onended = () => { if (--remaining === 0) finish(); };
      node.start(startTime);
      started.push(node);
      node.stop(endsAt);
    }
    if (!sources.length) finish();
  } catch (error) {
    try { stopStarted(context.currentTime); } finally { finish(); }
    throw error;
  }

  function cancel() {
    if (finished) return;
    outcome = 'cancelled';
    endsAt = context.currentTime;
    try { stopStarted(endsAt); } finally { finish(); }
  }

  function release(time = context.currentTime) {
    if (!Number.isFinite(time) || time < 0) throw new RangeError('Invalid release time.');
    if (finished) return;
    const at = Math.max(time, context.currentTime);
    if (at >= releaseAt) return;
    if (at <= startTime) { cancel(); return; }
    if (typeof amplitude.cancelAndHoldAtTime === 'function') {
      amplitude.cancelAndHoldAtTime(at);
    } else {
      amplitude.cancelScheduledValues(at);
      amplitude.linearRampToValueAtTime(envelopeValue(points, at), at);
    }
    endsAt = Math.min(endsAt, at + envelope.release);
    releaseAt = at;
    outcome = 'released';
    amplitude.linearRampToValueAtTime(0, endsAt);
    stopStarted(endsAt);
  }

  return Object.freeze({ startTime, get endsAt() { return endsAt; }, done, release, cancel });
}

function envelopeValue(points, at) {
  const next = points.findIndex(([time]) => time > at);
  if (next <= 0) return points[next === 0 ? 0 : points.length - 1][1];
  const [leftTime, leftGain] = points[next - 1];
  const [rightTime, rightGain] = points[next];
  return leftGain + (rightGain - leftGain) * (at - leftTime) / (rightTime - leftTime);
}
