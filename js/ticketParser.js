// Turns pasted or Live-Text-scanned text into lotto numbers. Pure — no DOM.
// Covered by tests/ticketParser.test.js.

import { GAMES, PICK_COUNT, BET_SLOTS } from './config.js';
import { validateSet } from './validation.js';

/**
 * Pull 1–2 digit numbers out of free text.
 * Peso amounts (P20.00, ₱20, PHP 20) are ignored. Longer digit runs (serial numbers) are
 * dropped, unless expandRuns is set, in which case an even-length run such as
 * "051223" is read as pairs (05 12 23) — handy when pasting into one row.
 */
export function splitNumbers(text, { expandRuns = false } = {}) {
  const tokens = String(text ?? '').replace(/(?:₱|PHP|\bP)\s?\d[\d,]*(?:\.\d{1,2})?/gi, ' ').split(/\D+/).filter(Boolean);
  const out = [];
  for (const t of tokens) {
    if (t.length <= 2) out.push(t);
    else if (expandRuns && t.length % 2 === 0) out.push(...t.match(/\d\d/g));
  }
  return out;
}

const GAME_NAME_HINTS = [
  [/ULTRA/i, 4],
  [/GRAND/i, 3],
  [/SUPER/i, 2],
  [/MEGA/i, 1],
];

/** Index into GAMES if the text names a game, otherwise null. */
export function detectGame(text) {
  const s = String(text ?? '');
  const m = /6\s*\/\s*(42|45|49|55|58)/.exec(s);
  if (m) return GAMES.findIndex(g => g.max === Number(m[1]));
  for (const [re, idx] of GAME_NAME_HINTS) if (re.test(s)) return idx;
  return null;
}

/**
 * Read bet lines from a ticket.
 * A line counts as a bet when it holds exactly six numbers, or starts with a
 * bet letter (A–F) and holds at least six (extra numbers after the first six
 * are ignored). Falls back to reading all numbers in groups of six when no
 * line qualifies (Live Text sometimes puts each number on its own line).
 *
 * @param {string} text
 * @param {number} fallbackGame index used when the ticket does not name a game
 * @returns {{gameIndex:number, gameDetected:boolean, bets:number[][], rejected:string[], overflow:number}}
 */
export function parseTicket(text, fallbackGame = 0) {
  const detected = detectGame(text);
  const gameIndex = detected ?? fallbackGame;
  const max = GAMES[gameIndex].max;
  const bets = [];
  const rejected = [];

  const tryAdd = (nums, label) => {
    const r = validateSet(nums, max);
    if (r.status === 'ok') bets.push(r.numbers);
    else rejected.push(`${label}: ${r.errors.join(' ')}`);
  };

  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach(line => {
    const nums = splitNumbers(line);
    const lettered = /^\s*[A-F]\s*[.:)\-]?\s+\d/i.test(line) || /^\s*[A-F]\d/i.test(line);
    if (nums.length === PICK_COUNT || (lettered && nums.length > PICK_COUNT)) {
      tryAdd(nums.slice(0, PICK_COUNT), `"${line.trim()}"`);
    }
  });

  if (!bets.length && !rejected.length) {
    const all = splitNumbers(text);
    if (all.length >= PICK_COUNT && all.length % PICK_COUNT === 0) {
      for (let i = 0; i < all.length; i += PICK_COUNT) tryAdd(all.slice(i, i + PICK_COUNT), `Numbers ${i + 1}–${i + PICK_COUNT}`);
    }
  }

  const overflow = Math.max(0, bets.length - BET_SLOTS);
  return { gameIndex, gameDetected: detected != null, bets: bets.slice(0, BET_SLOTS), rejected, overflow };
}
