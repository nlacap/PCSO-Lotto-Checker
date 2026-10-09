// Persistence: load/save with schema checks, migration and safe failure.
// `store` is injectable so the logic can be tested without a browser.

import { STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION, GAMES, BET_SLOTS, PICK_COUNT } from './config.js';

const defaultStore = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export const blankRow = () => Array(PICK_COUNT).fill('');
export const blankBets = () => Array.from({ length: BET_SLOTS }, blankRow);
export const blankGame = () => ({ date: '', bets: blankBets(), wins: blankRow() });
export const defaultState = () => ({
  v: SCHEMA_VERSION,
  game: 0,
  byGame: GAMES.map(blankGame),
});

const cleanCell = c => {
  const s = String(c ?? '').trim();
  return /^\d{1,2}$/.test(s) ? s : '';
};
const cleanRow = r => Array.from({ length: PICK_COUNT }, (_, i) => cleanCell(Array.isArray(r) ? r[i] : ''));
const cleanDate = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
const cleanGame = g => ({
  date: cleanDate(g?.date),
  bets: Array.from({ length: BET_SLOTS }, (_, i) => cleanRow(Array.isArray(g?.bets) ? g.bets[i] : null)),
  wins: cleanRow(g?.wins),
});

/**
 * Coerce anything read from storage into a valid state object.
 * Accepts the current shape, the earlier multi-game shape (no `v`),
 * and the original single-game shape {game, date, bets, wins}.
 */
export function sanitizeState(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object') return s;

  const gameIdx = Number.isInteger(raw.game) && raw.game >= 0 && raw.game < GAMES.length ? raw.game : 0;
  s.game = gameIdx;

  if (Array.isArray(raw.byGame)) {
    s.byGame = GAMES.map((_, i) => cleanGame(raw.byGame[i]));
  } else if (Array.isArray(raw.bets) || Array.isArray(raw.wins)) {
    s.byGame[gameIdx] = cleanGame(raw); // legacy single-game format
  }
  return s;
}

/** @returns {{state:object, warning:string|null}} */
export function loadState(store = defaultStore()) {
  if (!store) return { state: defaultState(), warning: 'Storage is not available (Private Browsing?). Entries will not be saved.' };

  let text;
  try { text = store.getItem(STORAGE_KEY); }
  catch { return { state: defaultState(), warning: 'Could not read saved data. Starting fresh.' }; }
  if (text == null) return { state: defaultState(), warning: null };

  try {
    return { state: sanitizeState(JSON.parse(text)), warning: null };
  } catch {
    try { store.setItem(BACKUP_KEY, text); } catch { /* ignore */ }
    return { state: defaultState(), warning: 'Saved data was damaged and has been reset. A backup copy was kept.' };
  }
}

/** @returns {{ok:boolean, error:string|null}} */
export function saveState(state, store = defaultStore()) {
  if (!store) return { ok: false, error: 'Storage is not available — changes are not being saved.' };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...state, v: SCHEMA_VERSION }));
    return { ok: true, error: null };
  } catch (e) {
    const full = e && (e.name === 'QuotaExceededError' || e.code === 22);
    return { ok: false, error: full ? 'Device storage is full — changes are not being saved.' : 'Could not save — changes are not being saved.' };
  }
}
