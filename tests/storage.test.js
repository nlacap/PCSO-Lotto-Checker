import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState, sanitizeState, defaultState, sanitizeResults, mergeResults, findResult, latestResult, loadResults, saveResults } from '../js/storage.js';
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

test('results: merge, find, latest, round trip', () => {
  let { db, added } = mergeResults({}, [
    { gameIndex: 4, date: '2026-10-07', numbers: [2, 14, 29, 30, 33, 38] },
    { gameIndex: 4, date: '2026-10-05', numbers: [1, 2, 3, 4, 5, 6] },
  ]);
  assert.equal(added, 2);
  assert.deepEqual(findResult(db, 4, '2026-10-05'), [1, 2, 3, 4, 5, 6]);
  assert.equal(findResult(db, 4, '2026-10-06'), null);
  assert.equal(latestResult(db, 4).date, '2026-10-07');
  const again = mergeResults(db, [{ gameIndex: 4, date: '2026-10-07', numbers: [2, 14, 29, 30, 33, 38] }]);
  assert.equal(again.same, 1);
  const s = memStore();
  assert.equal(saveResults(again.db, s).ok, true);
  assert.deepEqual(loadResults(s), again.db);
});

test('results: damaged entries are dropped', () => {
  const db = sanitizeResults({ 0: { '2026-10-08': [1, 2, 3, 4, 5, 99], 'bad': [1, 2, 3, 4, 5, 6], '2026-10-06': [6, 5, 4, 3, 2, 1] }, 9: {} });
  assert.deepEqual(db, { 0: { '2026-10-06': [1, 2, 3, 4, 5, 6] } });
  assert.deepEqual(loadResults(memStore({ 'pcso-lotto-results-v1': '{oops' })), {});
});
