import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, luckyPick } from '../js/luckyPick.js';
import { GAMES } from '../js/config.js';

test('six different sorted numbers in range, for every game', () => {
  for (const g of GAMES) {
    for (let i = 0; i < 2000; i++) {
      const p = luckyPick(g.max);
      assert.equal(p.length, 6);
      assert.equal(new Set(p).size, 6);
      assert.ok(p.every(n => Number.isInteger(n) && n >= 1 && n <= g.max));
      assert.deepEqual(p, [...p].sort((a, b) => a - b));
    }
  }
});

test('keeps numbers already chosen', () => {
  const p = luckyPick(42, { keep: [7, 13, 99] }); // 99 is out of range and dropped
  assert.ok(p.includes(7) && p.includes(13));
  assert.equal(p.length, 6);
});

test('every number comes up about equally often (6/58, 300k picks)', () => {
  const max = 58, counts = Array(max + 1).fill(0), draws = 300000;
  for (let i = 0; i < draws; i++) counts[randomInt(max)]++;
  const expected = draws / max;
  // chi-square with 57 degrees of freedom; 99.9% critical value ≈ 97
  const chi = counts.slice(1).reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
  assert.ok(chi < 97, `chi-square ${chi.toFixed(1)} too high`);
});

test('rejection sampling: values in the biased tail are redrawn', () => {
  const seq = [2 ** 32 - 1, 5]; // first value is above the limit for max=42
  const source = { getRandomValues: a => { a[0] = seq.shift(); return a; } };
  assert.equal(randomInt(42, source), (5 % 42) + 1);
});

test('fails loudly without a secure source', () => {
  assert.throws(() => randomInt(42, {}), TypeError);
});
