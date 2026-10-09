// Pure validation and matching logic — no DOM, no storage.
// Everything here is covered by tests/validation.test.js.

import { PICK_COUNT, DAY_NAMES, PRIZE_TIERS } from './config.js';

/** Strip anything that is not a digit and cap at two characters (used while typing). */
export function sanitizeInput(raw) {
  return String(raw ?? '').replace(/\D+/g, '').slice(0, 2);
}

/**
 * Parse a single cell.
 * @returns {{kind:'empty'} | {kind:'ok', value:number} | {kind:'invalid', error:string}}
 */
export function parseCell(raw, max) {
  const s = String(raw ?? '').trim();
  if (s === '') return { kind: 'empty' };
  if (!/^\d{1,2}$/.test(s)) return { kind: 'invalid', error: `"${s}" is not a whole number` };
  const value = Number(s);
  if (value < 1 || value > max) return { kind: 'invalid', error: `${value} is outside 1–${max}` };
  return { kind: 'ok', value };
}

/**
 * Validate a row of six cells.
 * @param {string[]} cells
 * @param {number} max         highest valid number for the game
 * @param {{allowEmpty?:boolean}} [opts]
 * @returns {{status:'empty'|'ok'|'invalid', numbers:number[], errors:string[], badIndexes:number[]}}
 *   numbers is sorted ascending when status === 'ok'.
 */
export function validateSet(cells, max, { allowEmpty = false } = {}) {
  const parsed = Array.from({ length: PICK_COUNT }, (_, i) => parseCell(cells?.[i], max));
  const errors = [];
  const bad = new Set();

  const filled = parsed.filter(p => p.kind !== 'empty').length;
  if (filled === 0) {
    return allowEmpty
      ? { status: 'empty', numbers: [], errors: [], badIndexes: [] }
      : { status: 'invalid', numbers: [], errors: [`Enter ${PICK_COUNT} numbers.`], badIndexes: [...Array(PICK_COUNT).keys()] };
  }

  parsed.forEach((p, i) => {
    if (p.kind === 'invalid') { errors.push(p.error + '.'); bad.add(i); }
  });

  // duplicates
  const seen = new Map();
  parsed.forEach((p, i) => {
    if (p.kind !== 'ok') return;
    if (seen.has(p.value)) {
      bad.add(i); bad.add(seen.get(p.value));
      const msg = `${p.value} is entered more than once.`;
      if (!errors.includes(msg)) errors.push(msg);
    } else seen.set(p.value, i);
  });

  if (filled < PICK_COUNT) {
    errors.push(`Only ${filled} of ${PICK_COUNT} numbers entered.`);
    parsed.forEach((p, i) => { if (p.kind === 'empty') bad.add(i); });
  }

  if (errors.length) {
    return { status: 'invalid', numbers: [], errors, badIndexes: [...bad].sort((a, b) => a - b) };
  }
  const numbers = parsed.map(p => p.value).sort((a, b) => a - b);
  return { status: 'ok', numbers, errors: [], badIndexes: [] };
}

/**
 * Light check while typing: flags cells that are already clearly wrong
 * (out of range / duplicate) without complaining about cells not yet filled.
 */
export function liveCheck(cells, max) {
  const r = validateSet(cells, max, { allowEmpty: true });
  if (r.status !== 'invalid') return { badIndexes: [], errors: [] };
  const errors = r.errors.filter(e => !e.startsWith('Only '));
  const badIndexes = r.badIndexes.filter(i => String(cells?.[i] ?? '').trim() !== '');
  return { badIndexes, errors };
}

/** Parse "YYYY-MM-DD" into a local Date, or null if it is not a real calendar date. */
export function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * Validate the draw date for a game.
 * Errors block the comparison; warnings are only shown.
 */
export function validateDrawDate(iso, game, today = new Date()) {
  if (!iso) return { ok: false, error: 'Enter the draw date.', warnings: [] };
  const date = parseIsoDate(iso);
  if (!date) return { ok: false, error: 'The draw date is not a valid date.', warnings: [] };

  const warnings = [];
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date > todayMidnight) warnings.push('The draw date is in the future — results may not be official yet.');
  if (game?.drawDays && !game.drawDays.includes(date.getDay())) {
    const days = game.drawDays.map(d => DAY_NAMES[d]).join(', ');
    warnings.push(`${game.name} is normally drawn on ${days}, but ${iso} is a ${DAY_NAMES[date.getDay()]}. Please double-check the date.`);
  }
  return { ok: true, error: null, warnings };
}

/** Numbers in `bet` that also appear in `winning`. */
export function matchNumbers(bet, winning) {
  const w = new Set(winning);
  return bet.filter(n => w.has(n));
}

/** Prize label for a match count, or null when it doesn't win. */
export function prizeTier(count) {
  return PRIZE_TIERS[count] ?? null;
}

/** Groups of bet indexes that contain exactly the same numbers. */
export function findDuplicateBets(bets) {
  const byKey = new Map();
  bets.forEach((b, i) => {
    if (!b) return;
    const key = [...b].sort((x, y) => x - y).join(',');
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(i);
  });
  return [...byKey.values()].filter(g => g.length > 1);
}
