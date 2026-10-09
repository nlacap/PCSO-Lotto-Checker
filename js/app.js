// Controller: owns the state, builds the page, wires events, runs the comparison.

import { APP_VERSION, GAMES, BET_SLOTS, PICK_COUNT, STORAGE_KEY } from './config.js';
import {
  sanitizeInput, validateSet, liveCheck, validateDrawDate,
  matchNumbers, prizeTier, findDuplicateBets,
} from './validation.js';
import { loadState, saveState, blankBets, blankRow } from './storage.js';
import { $, $$, el } from './dom.js';
import { setStatus } from './status.js';
import { createPicker } from './picker.js';

// ---------------------------------------------------------------- state

const initial = loadState();
let state = initial.state;
const picker = createPicker();

const game = () => GAMES[state.game];
const draw = () => state.byGame[state.game];

/** Cells for a row key: 'w' = winning numbers, 0..5 = bet index. */
const rowCells = key => (key === 'w' ? draw().wins : draw().bets[key]);
const rowInputs = key => $$(`.cell[data-row="${key}"]`);
const rowHint = key => $(key === 'w' ? '#winHint' : `#hint${key}`);

function persist() {
  const r = saveState(state);
  const label = $('#saveState');
  label.classList.toggle('warn', !r.ok);
  label.textContent = r.ok
    ? 'Saved on this device • ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '⚠ ' + r.error;
}

// ---------------------------------------------------------------- build

function cellInputs(rowKey, labelPrefix) {
  return Array.from({ length: PICK_COUNT }, (_, j) => el('input', {
    class: 'cell ' + (rowKey === 'w' ? 'winnum' : 'betnum'),
    'data-row': rowKey,
    'data-j': j,
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    maxlength: 2,
    autocomplete: 'off',
    placeholder: j + 1,
    'aria-label': `${labelPrefix} number ${j + 1}`,
  }));
}

function build() {
  $('#bets').replaceChildren(...Array.from({ length: BET_SLOTS }, (_, i) =>
    el('div', { class: 'bet' }, [
      el('div', { class: 'betHead' }, [
        el('strong', {}, `Bet ${i + 1}`),
        el('button', { class: 'pickBet', type: 'button', 'data-i': i }, 'SELECT ON NUMBER BOARD'),
      ]),
      el('div', { class: 'six' }, cellInputs(i, `Bet ${i + 1}`)),
      el('div', { class: 'hint', id: `hint${i}`, 'aria-live': 'polite' }),
      el('div', { class: 'result', id: `r${i}` }),
    ]),
  ));
  $('#wins').replaceChildren(...cellInputs('w', 'Winning'));
  $('#version').textContent = 'v' + APP_VERSION;
  wire();
}

// ---------------------------------------------------------------- render

function render() {
  const g = game();
  $$('.tab').forEach((t, i) => {
    t.classList.toggle('active', i === state.game);
    t.setAttribute('aria-pressed', String(i === state.game));
  });
  $('#gameLabel').textContent = `${g.name} • Valid numbers 1–${g.max}`;
  $('#drawDate').value = draw().date;
  $$('.cell').forEach(x => {
    const key = x.dataset.row === 'w' ? 'w' : Number(x.dataset.row);
    x.value = rowCells(key)[Number(x.dataset.j)];
  });
  clearResults();
  ['w', ...Array.from({ length: BET_SLOTS }, (_, i) => i)].forEach(liveValidate);
  showDateHint();
}

function liveValidate(key) {
  const { badIndexes, errors } = liveCheck(rowCells(key), game().max);
  rowInputs(key).forEach((x, j) => x.classList.toggle('invalid', badIndexes.includes(j)));
  const hint = rowHint(key);
  hint.className = 'hint';
  hint.textContent = errors.join(' ');
}

function showDateHint() {
  const hint = $('#dateHint');
  const d = draw().date;
  const r = d ? validateDrawDate(d, game()) : { ok: true, warnings: [] };
  hint.className = 'hint' + (r.ok ? ' warn' : '');
  hint.textContent = r.ok ? r.warnings.join(' ') : r.error;
}

function clearResults() {
  $$('.cell').forEach(x => x.classList.remove('match'));
  $$('.result').forEach(x => { x.textContent = ''; x.className = 'result'; });
}

// ---------------------------------------------------------------- events

function onCellInput(e) {
  const x = e.target;
  const clean = sanitizeInput(x.value);
  if (clean !== x.value) x.value = clean;

  const key = x.dataset.row === 'w' ? 'w' : Number(x.dataset.row);
  rowCells(key)[Number(x.dataset.j)] = clean;
  persist();
  clearResults();
  liveValidate(key);

  // jump to the next box once the number can't get any longer
  const typing = !e.inputType || e.inputType.startsWith('insert');
  if (typing && (clean.length === 2 || (clean.length === 1 && Number(clean) * 10 > game().max))) {
    const inputs = rowInputs(key);
    inputs[Number(x.dataset.j) + 1]?.focus();
  }
}

function hasAnyBet() { return draw().bets.flat().some(Boolean); }
function hasAnything() { return hasAnyBet() || draw().wins.some(Boolean) || !!draw().date; }

function wire() {
  $$('.tab').forEach((t, i) => t.addEventListener('click', () => {
    if (i === state.game) return;
    state.game = i;
    persist();
    render();
    setStatus('info', `${GAMES[i].name} selected. Its saved bets were loaded.`);
  }));

  $('#drawDate').addEventListener('change', e => {
    draw().date = e.target.value;
    persist();
    clearResults();
    showDateHint();
  });

  document.addEventListener('input', e => { if (e.target.classList?.contains('cell')) onCellInput(e); });
  document.addEventListener('focusin', e => { if (e.target.classList?.contains('cell')) e.target.select?.(); });

  $('#bets').addEventListener('click', e => {
    const b = e.target.closest('.pickBet');
    if (!b) return;
    const i = Number(b.dataset.i);
    picker.open({
      heading: `Select Numbers for Bet ${i + 1}`,
      numbers: draw().bets[i].filter(Boolean),
      max: game().max,
      onSave: nums => { draw().bets[i] = nums.map(String); afterEdit(`Bet ${i + 1} saved.`); },
    });
  });

  $('#pickWin').addEventListener('click', () => picker.open({
    heading: 'Select Winning Numbers',
    numbers: draw().wins.filter(Boolean),
    max: game().max,
    onSave: nums => { draw().wins = nums.map(String); afterEdit('Winning numbers saved.'); },
  }));

  $('#clearBets').addEventListener('click', () => {
    if (hasAnyBet() && !confirm('Clear all bets for ' + game().name + '?')) return;
    draw().bets = blankBets();
    afterEdit('All bets cleared.');
  });

  $('#clearWin').addEventListener('click', () => {
    draw().wins = blankRow();
    afterEdit('Winning numbers cleared.');
  });

  $('#newDraw').addEventListener('click', () => {
    if (hasAnything() && !confirm('Clear the draw date, all bets and winning numbers?')) return;
    state.byGame[state.game] = { date: '', bets: blankBets(), wins: blankRow() };
    afterEdit('Ready for a new draw.');
  });

  $('#compare').addEventListener('click', compare);

  // keep two open tabs in sync
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY) return;
    state = loadState().state;
    render();
    setStatus('info', 'Updated with changes made in another tab.');
  });
}

function afterEdit(message) {
  persist();
  render();
  setStatus('info', message);
}

// ---------------------------------------------------------------- compare

function markBad(key, indexes) {
  rowInputs(key).forEach((x, j) => x.classList.toggle('invalid', indexes.includes(j)));
}

function compare() {
  clearResults();
  const g = game();
  const d = draw();
  const problems = [];
  const warnings = [];

  const date = validateDrawDate(d.date, g);
  if (!date.ok) problems.push(date.error);
  else warnings.push(...date.warnings);

  const win = validateSet(d.wins, g.max);
  if (win.status !== 'ok') {
    problems.push('Winning numbers: ' + win.errors.join(' '));
    markBad('w', win.badIndexes);
  }

  const bets = d.bets.map(b => validateSet(b, g.max, { allowEmpty: true }));
  const badBets = [];
  bets.forEach((r, i) => {
    if (r.status !== 'invalid') return;
    badBets.push(`Bet ${i + 1}: ${r.errors.join(' ')}`);
    markBad(i, r.badIndexes);
    const res = $(`#r${i}`);
    res.textContent = 'Not checked — fix this bet first.';
    res.className = 'result error';
  });

  const validBets = bets.map(r => (r.status === 'ok' ? r.numbers : null));
  const validCount = validBets.filter(Boolean).length;
  if (validCount === 0 && badBets.length === 0) problems.push('Enter at least one complete bet.');

  // Cannot compare at all: stop and list everything that is wrong.
  if (problems.length || validCount === 0) {
    setStatus('error', 'Please fix the following:', [...problems, ...badBets]);
    $('.cell.invalid')?.focus();
    return;
  }

  findDuplicateBets(validBets).forEach(group =>
    warnings.push(`Bets ${group.map(i => i + 1).join(' and ')} have the same numbers.`));

  let best = 0;
  let winners = 0;
  let jackpot = false;
  const matchedWinning = new Set();

  validBets.forEach((nums, i) => {
    if (!nums) return;
    const hits = matchNumbers(nums, win.numbers);
    hits.forEach(n => matchedWinning.add(n));
    best = Math.max(best, hits.length);

    rowInputs(i).forEach(x => x.classList.toggle('match', hits.includes(Number(x.value))));

    const tier = prizeTier(hits.length);
    const res = $(`#r${i}`);
    if (hits.length === PICK_COUNT) {
      res.textContent = '🎉 JACKPOT! 6/6 MATCH 🎉';
      res.className = 'result jackpot';
      jackpot = true;
    } else if (tier) {
      res.textContent = `${hits.length}/6 matches • ${tier}`;
      res.className = 'result prize';
    } else {
      res.textContent = `${hits.length}/6 matches • No prize`;
      res.className = 'result none';
    }
    if (tier) winners++;
  });

  rowInputs('w').forEach(x => x.classList.toggle('match', matchedWinning.has(Number(x.value))));

  const summary = jackpot
    ? 'JACKPOT! A bet matched all six winning numbers.'
    : `Checked ${validCount} bet${validCount > 1 ? 's' : ''}. Best result: ${best}/6. ` +
      (winners ? `${winners} winning bet${winners > 1 ? 's' : ''}.` : 'No winning bets.');

  const notes = [...badBets, ...warnings];
  setStatus(jackpot || winners ? (notes.length ? 'warn' : 'success') : (notes.length ? 'warn' : 'info'), summary, notes);
  if (jackpot) celebrate();
}

function celebrate() {
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 2600);
}

// ---------------------------------------------------------------- start

window.addEventListener('error', e => setStatus('error', 'Unexpected error: ' + (e.message || 'unknown') + '. Please reload the page.'));
window.addEventListener('unhandledrejection', e => setStatus('error', 'Unexpected error: ' + (e.reason?.message || e.reason || 'unknown') + '.'));

build();
render();
if (initial.warning) {
  setStatus('warn', initial.warning);
  $('#saveState').textContent = '⚠ ' + initial.warning;
  $('#saveState').classList.add('warn');
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
