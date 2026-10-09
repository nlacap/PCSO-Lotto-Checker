import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeInput, parseCell, validateSet, liveCheck, parseIsoDate,
  validateDrawDate, matchNumbers, prizeTier, findDuplicateBets,
} from '../js/validation.js';
import { GAMES } from '../js/config.js';

const g642 = GAMES[0];

test('sanitizeInput keeps at most two digits', () => {
  assert.equal(sanitizeInput('4a2'), '42');
  assert.equal(sanitizeInput('-5'), '5');
  assert.equal(sanitizeInput('1.5'), '15');
  assert.equal(sanitizeInput('123'), '12');
  assert.equal(sanitizeInput(null), '');
});

test('parseCell', () => {
  assert.deepEqual(parseCell('', 42), { kind: 'empty' });
  assert.deepEqual(parseCell(' 7 ', 42), { kind: 'ok', value: 7 });
  assert.deepEqual(parseCell('07', 42), { kind: 'ok', value: 7 });
  assert.equal(parseCell('0', 42).kind, 'invalid');
  assert.equal(parseCell('43', 42).kind, 'invalid');
  assert.equal(parseCell('43', 45).kind, 'ok');
  assert.equal(parseCell('e', 42).kind, 'invalid');
  assert.equal(parseCell('4.5', 42).kind, 'invalid');
});

test('validateSet: valid row is sorted', () => {
  const r = validateSet(['30', '2', '15', '42', '1', '9'], 42);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.numbers, [1, 2, 9, 15, 30, 42]);
});

test('validateSet: empty row', () => {
  assert.equal(validateSet(Array(6).fill(''), 42, { allowEmpty: true }).status, 'empty');
  assert.equal(validateSet(Array(6).fill(''), 42).status, 'invalid');
});

test('validateSet: reports every problem and the cells involved', () => {
  const r = validateSet(['5', '5', '50', '', '1', '2'], 42);
  assert.equal(r.status, 'invalid');
  assert.deepEqual(r.badIndexes, [0, 1, 2, 3]);
  assert.ok(r.errors.some(e => e.includes('outside 1–42')));
  assert.ok(r.errors.some(e => e.includes('more than once')));
  assert.ok(r.errors.some(e => e.includes('5 of 6')));
});

test('liveCheck ignores cells not typed yet', () => {
  assert.deepEqual(liveCheck(['1', '2', '', '', '', ''], 42), { badIndexes: [], errors: [] });
  const r = liveCheck(['1', '1', '', '', '', ''], 42);
  assert.deepEqual(r.badIndexes, [0, 1]);
});

test('parseIsoDate rejects impossible dates', () => {
  assert.ok(parseIsoDate('2026-10-08'));
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate('10/08/2026'), null);
});

test('validateDrawDate', () => {
  const today = new Date(2026, 9, 9); // Fri 9 Oct 2026
  assert.equal(validateDrawDate('', g642, today).ok, false);
  assert.equal(validateDrawDate('2026-13-01', g642, today).ok, false);
  // Thu 8 Oct is a 6/42 draw day
  assert.deepEqual(validateDrawDate('2026-10-08', g642, today).warnings, []);
  // Wed 7 Oct is not
  assert.equal(validateDrawDate('2026-10-07', g642, today).warnings.length, 1);
  // Future date warns but is still allowed
  const f = validateDrawDate('2026-10-10', g642, today);
  assert.equal(f.ok, true);
  assert.ok(f.warnings[0].includes('future'));
});

test('matching and prizes', () => {
  assert.deepEqual(matchNumbers([1, 2, 3, 4, 5, 6], [4, 5, 6, 7, 8, 9]), [4, 5, 6]);
  assert.equal(prizeTier(6), 'JACKPOT');
  assert.ok(prizeTier(3));
  assert.equal(prizeTier(2), null);
});

test('findDuplicateBets', () => {
  const a = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(findDuplicateBets([a, null, [6, 5, 4, 3, 2, 1], [1, 2, 3, 4, 5, 7]]), [[0, 2]]);
});
