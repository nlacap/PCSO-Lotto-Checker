import test from 'node:test';
import assert from 'node:assert/strict';
import { splitNumbers, detectGame, parseTicket } from '../js/ticketParser.js';

test('splitNumbers', () => {
  assert.deepEqual(splitNumbers('05-12-23 34,40 41'), ['05', '12', '23', '34', '40', '41']);
  assert.deepEqual(splitNumbers('A 5 12 P20.00 SN 123456789'), ['5', '12']);
  assert.deepEqual(splitNumbers('051223344041', { expandRuns: true }), ['05', '12', '23', '34', '40', '41']);
  assert.deepEqual(splitNumbers('051223344041'), []);
  assert.deepEqual(splitNumbers('05.12.23.34.40.41'), ['05', '12', '23', '34', '40', '41']);
  assert.deepEqual(splitNumbers('₱20 PHP 40.00 7'), ['7']);
});

test('detectGame', () => {
  assert.equal(detectGame('LOTTO 6/42'), 0);
  assert.equal(detectGame('Mega Lotto'), 1);
  assert.equal(detectGame('6 / 55 GRAND'), 3);
  assert.equal(detectGame('ULTRA LOTTO'), 4);
  assert.equal(detectGame('hello'), null);
});

test('parseTicket: typical scanned ticket', () => {
  const t = `PCSO
SUPER LOTTO 6/49
DRAW 10/08/26 THU
A. 03 11 19 27 38 45
B. 07 14 22 30 41 49  QP
C 01 02 03 04 05 06
TOTAL P60.00
SN 0012 3456 7890 1234`;
  const r = parseTicket(t, 0);
  assert.equal(r.gameIndex, 2);
  assert.equal(r.gameDetected, true);
  assert.deepEqual(r.bets, [[3, 11, 19, 27, 38, 45], [7, 14, 22, 30, 41, 49], [1, 2, 3, 4, 5, 6]]);
});

test('parseTicket: one number per line falls back to groups of six', () => {
  const r = parseTicket('5\n10\n15\n20\n25\n30\n1\n2\n3\n4\n5\n6', 0);
  assert.equal(r.bets.length, 2);
});

test('parseTicket: out-of-range line is rejected, not silently kept', () => {
  const r = parseTicket('A 01 02 03 04 05 50', 0); // 50 > 42
  assert.equal(r.bets.length, 0);
  assert.equal(r.rejected.length, 1);
});

test('parseTicket: more than six bets reports overflow', () => {
  const line = n => `${'ABCDEFG'[n]} ${[1, 2, 3, 4, 5, 6].map(x => x + n).join(' ')}`;
  const r = parseTicket(Array.from({ length: 7 }, (_, n) => line(n)).join('\n'), 4);
  assert.equal(r.bets.length, 6);
  assert.equal(r.overflow, 1);
});
