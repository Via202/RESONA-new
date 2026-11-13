// FNV-1a over UTF-16 code units, followed by a 32-bit Mulberry generator.
export function seededRandom(seed, stream) {
  if (typeof seed !== 'string' && !Number.isSafeInteger(seed)) {
    throw new TypeError('Seed must be a string or a safe integer.');
  }
  let state = 2166136261;
  const key = JSON.stringify([typeof seed, seed, stream]);
  for (let i = 0; i < key.length; i++) {
    state = Math.imul(state ^ key.charCodeAt(i), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let bits = Math.imul(state ^ (state >>> 15), state | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
  };
}
