import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState, sanitizeState, defaultState } from '../js/storage.js';
import { STORAGE_KEY, BACKUP_KEY, GAMES } from '../js/config.js';

const memStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test('empty storage gives default state', () => {
  const { state, warning } = loadState(memStore());
  assert.deepEqual(state, defaultState());
  assert.equal(warning, null);
});

test('round trip', () => {
  const s = memStore();
  const st = defaultState();
  st.game = 2;
  st.byGame[2].bets[0] = ['1', '2', '3', '4', '5', '6'];
  assert.equal(saveState(st, s).ok, true);
  assert.deepEqual(loadState(s).state, st);
});

test('damaged JSON is reset and backed up', () => {
  const s = memStore({ [STORAGE_KEY]: '{oops' });
  const { state, warning } = loadState(s);
  assert.deepEqual(state, defaultState());
  assert.ok(warning);
  assert.equal(s.m.get(BACKUP_KEY), '{oops');
});

test('migrates the original single-game format', () => {
  const st = sanitizeState({ game: 1, date: '2026-10-08', bets: [['1', '2', '3', '4', '5', '6']], wins: ['7', '8', '9', '10', '11', '12'] });
  assert.equal(st.game, 1);
  assert.equal(st.byGame[1].date, '2026-10-08');
  assert.deepEqual(st.byGame[1].bets[0], ['1', '2', '3', '4', '5', '6']);
  assert.equal(st.byGame[1].bets.length, 6);
});

test('repairs bad shapes and values', () => {
  const st = sanitizeState({ game: 99, byGame: [{ date: 'yesterday', bets: 'x', wins: ['1', 'abc', 7, null] }] });
  assert.equal(st.game, 0);
  assert.equal(st.byGame.length, GAMES.length);
  assert.equal(st.byGame[0].date, '');
  assert.deepEqual(st.byGame[0].wins, ['1', '', '7', '', '', '']);
  assert.equal(st.byGame[0].bets.length, 6);
});

test('save failure is reported, not thrown', () => {
  const s = { getItem: () => null, setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } };
  const r = saveState(defaultState(), s);
  assert.equal(r.ok, false);
  assert.match(r.error, /full/);
});

test('missing storage is reported', () => {
  assert.ok(loadState(null).warning);
  assert.equal(saveState(defaultState(), null).ok, false);
});
