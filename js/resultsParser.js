// Reads PCSO "Search Lotto" results that were copied from pcso.gov.ph or
// scanned from a screenshot with Live Text. Pure — no DOM.
// Covered by tests/resultsParser.test.js.
//
// Handles two layouts:
//  • row by row   – "Ultra Lotto 6/58  29-38-33-14-02-30  10/7/2026  49,500,000.00  0"
//  • column by column (Live Text often reads tables this way) – all game names,
//    then all combinations, then all dates. These are paired up in order.

import { GAMES } from './config.js';
import { validateSet, parseIsoDate } from './validation.js';

// Any game PCSO lists (including 2D/3D/4D/6D) so columns stay aligned.
const GAME_LINE = /(ultra\s*lotto|grand\s*lotto|super\s*lotto|mega\s*lotto|lotto\s*6\s*\/\s*42|\b6\s*\/\s*(?:42|45|49|55|58)\b|\b[2346]\s*d\b|swertres|ez\s*2|\blotto\b)/i;
const COMBO = /\b\d{1,2}(?:\s*-\s*\d{1,2}){1,5}\b/g;
const NOT_A_GAME = /search|select|lotto\s*game|results?\b|combination|jackpot|winners/i;
const DATE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;

/** Map a PCSO game label to an index in GAMES, or null for non 6-number games. */
export function gameFromLabel(label) {
  const s = String(label ?? '');
  if (/\b[2346]\s*d\b|swertres|ez\s*2/i.test(s)) return null;
  const m = /6\s*\/\s*(42|45|49|55|58)/.exec(s);
  if (m) return GAMES.findIndex(g => g.max === Number(m[1]));
  if (/ultra/i.test(s)) return 4;
  if (/grand/i.test(s)) return 3;
  if (/super/i.test(s)) return 2;
  if (/mega/i.test(s)) return 1;
  return null;
}

/** "10/7/2026" (month/day/year, as PCSO shows it) -> "2026-10-07", or null. */
export function toIsoDate(m, d, y) {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return parseIsoDate(iso) ? iso : null;
}

const combosIn = s => (String(s).match(COMBO) || []).map(c => c.split('-').map(x => x.trim()));
const datesIn = s => [...String(s).matchAll(DATE)].map(m => toIsoDate(m[1], m[2], m[3]));

/**
 * @param {string} text
 * @param {{fallbackDate?:string}} [opts] used when the text has no draw dates
 *   (e.g. a screenshot that cuts off the DRAW DATE column)
 * @returns {{results: {gameIndex:number, date:string, numbers:number[]}[], rejected:string[]}}
 *   numbers are sorted ascending. Duplicate rows are collapsed.
 */
export function parseResults(text, { fallbackDate = null } = {}) {
  const lines = String(text ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];

  // 1) row by row: game, combination and date on one line
  let rowMode = 0;
  lines.forEach(line => {
    const combos = combosIn(line);
    const dates = datesIn(line);
    if (GAME_LINE.test(line) && combos.length && (dates.length || fallbackDate)) {
      rowMode++;
      rows.push({ label: line, combo: combos[0], date: dates[0] ?? fallbackDate });
    }
  });

  // 2) column by column fallback
  if (!rowMode) {
    const labels = lines.filter(l => GAME_LINE.test(l) && !NOT_A_GAME.test(l) && l.length < 40 && !combosIn(l).length);
    const combos = lines.flatMap(combosIn);
    const dates = lines.flatMap(datesIn);
    const n = Math.min(labels.length, combos.length);
    for (let i = 0; i < n; i++) rows.push({ label: labels[i], combo: combos[i], date: dates[i] ?? fallbackDate });
  }

  const results = [];
  const rejected = [];
  const seen = new Set();
  rows.forEach(({ label, combo, date }) => {
    const gameIndex = gameFromLabel(label);
    if (gameIndex == null) return; // 2D/3D/4D/6D — not supported, skip quietly
    const name = GAMES[gameIndex].name;
    if (!date) { rejected.push(`${name}: draw date not found — set the Draw Date above, then paste again.`); return; }
    const v = validateSet(combo, GAMES[gameIndex].max);
    if (v.status !== 'ok') { rejected.push(`${name} ${date}: ${v.errors.join(' ')}`); return; }
    const key = gameIndex + '|' + date;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ gameIndex, date, numbers: v.numbers });
  });
  return { results, rejected };
}
