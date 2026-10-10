import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResults, gameFromLabel, toIsoDate } from '../js/resultsParser.js';

test('gameFromLabel', () => {
  assert.equal(gameFromLabel('Ultra Lotto 6/58'), 4);
  assert.equal(gameFromLabel('Megalotto 6/45'), 1);
  assert.equal(gameFromLabel('Superlotto 6/49'), 2);
  assert.equal(gameFromLabel('Lotto 6/42'), 0);
  assert.equal(gameFromLabel('4D Lotto'), null);
  assert.equal(gameFromLabel('6D Lotto'), null);
  assert.equal(gameFromLabel('3D Lotto 2PM'), null);
});

test('toIsoDate', () => {
  assert.equal(toIsoDate(10, 7, 2026), '2026-10-07');
  assert.equal(toIsoDate(2, 30, 2026), null);
});

test('row layout copied from pcso.gov.ph', () => {
  const t = `Search Results
LOTTO GAME	COMBINATIONS	DRAW DATE	JACKPOT (PHP)	WINNERS
Ultra Lotto 6/58	29-38-33-14-02-30	10/7/2026	49,500,000.00	0
Megalotto 6/45	30-24-32-26-35-25	10/7/2026	8,910,000.00	0
4D Lotto	7-1-7-9	10/7/2026	22,000.00	2
3D Lotto 2PM	4-5-1	10/7/2026	4,500.00	300
6D Lotto	1-2-3-4-5-6	10/7/2026	2,000,000.00	0`;
  const r = parseResults(t);
  assert.deepEqual(r.rejected, []);
  assert.deepEqual(r.results, [
    { gameIndex: 4, date: '2026-10-07', numbers: [2, 14, 29, 30, 33, 38] },
    { gameIndex: 1, date: '2026-10-07', numbers: [24, 25, 26, 30, 32, 35] },
  ]);
});

test('column layout from Live Text on a screenshot', () => {
  const t = `LOTTO GAME
Ultra Lotto 6/58
Megalotto 6/45
4D Lotto
COMBINATIONS
29-38-33-14-02-30
30-24-32-26-35-25
7-1-7-9
DRAW DATE
10/7/2026
10/7/2026
10/7/2026`;
  const r = parseResults(t);
  assert.equal(r.results.length, 2);
  assert.equal(r.results[0].gameIndex, 4);
  assert.equal(r.results[1].date, '2026-10-07');
});

test('several dates and bad rows', () => {
  const t = `Grand Lotto 6/55 01-02-03-04-05-56 10/6/2026 30,000,000.00 0
Grand Lotto 6/55 01-02-03-04-05-06 10/4/2026 29,000,000.00 0
Lotto 6/42 11-12-13-14-15-16 10/8/2026 6,000,000.00 0
Lotto 6/42 11-12-13-14-15-16 10/8/2026 6,000,000.00 0`;
  const r = parseResults(t);
  assert.equal(r.results.length, 2); // bad 56 rejected, duplicate collapsed
  assert.equal(r.rejected.length, 1);
  assert.match(r.rejected[0], /56 is outside 1–55/);
});

test('nothing recognisable', () => {
  assert.deepEqual(parseResults('hello'), { results: [], rejected: [] });
});

test('screenshot of the search page with the date column cut off', () => {
  const t = `From:
October
7
2026
Select Lotto Game
All Games
Search Lotto
Search Results
LOTTO GAME COMBINATIONS D
Ultra Lotto 6/58
29-38-33-14-02-30
Megalotto 6/45
30-24-32-26-35-25
4D Lotto
7-1-7-9`;
  const none = parseResults(t);
  assert.equal(none.results.length, 0);
  assert.equal(none.rejected.length, 2);
  const r = parseResults(t, { fallbackDate: '2026-10-07' });
  assert.deepEqual(r.results.map(x => [x.gameIndex, x.date]), [[4, '2026-10-07'], [1, '2026-10-07']]);
});
