// Lucky Pick: truly random lotto numbers.
//
// Uses the Web Crypto random generator (crypto.getRandomValues) — the same
// cryptographically secure source browsers use for keys — rather than
// Math.random(). Rejection sampling removes modulo bias, so every number in
// 1..max has exactly the same chance. Pure apart from the injectable source.

import { PICK_COUNT } from './config.js';

const defaultSource = () => {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) throw new Error('Secure random numbers are not available on this device.');
  return c;
};

/** Uniform random integer in [1, max] with no modulo bias. */
export function randomInt(max, source = defaultSource()) {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RangeError('max out of range');
  const range = 2 ** 32;
  const limit = range - (range % max); // largest multiple of max below 2^32
  const buf = new Uint32Array(1);
  for (;;) {
    source.getRandomValues(buf);
    if (buf[0] < limit) return (buf[0] % max) + 1;
  }
}

/**
 * Pick `count` different numbers from 1..max, keeping any numbers already
 * chosen (`keep`) and drawing only the rest. Returns them sorted.
 */
export function luckyPick(max, { count = PICK_COUNT, keep = [], source } = {}) {
  const chosen = new Set(keep.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= max));
  if (chosen.size > count) return [...chosen].sort((a, b) => a - b).slice(0, count);
  if (count > max) throw new RangeError('Cannot pick more numbers than the game has.');
  while (chosen.size < count) chosen.add(randomInt(max, source ?? defaultSource()));
  return [...chosen].sort((a, b) => a - b);
}
