// Number-board overlay. Knows nothing about bets or storage —
// the caller passes the starting numbers and an onSave callback.

import { $, el } from './dom.js';
import { PICK_COUNT, MAX_NUMBER } from './config.js';

export function createPicker() {
  const overlay = $('#overlay');
  const grid = $('#grid');
  const counter = $('#counter');
  const title = $('#pickerTitle');

  let picked = [];
  let max = MAX_NUMBER;
  let onSave = null;
  let returnFocus = null;

  for (let n = 1; n <= MAX_NUMBER; n++) {
    grid.append(el('button', { class: 'num', type: 'button', 'data-n': n, 'aria-pressed': 'false' }, String(n)));
  }

  function draw(message) {
    const full = picked.length >= PICK_COUNT;
    counter.textContent = message ?? `${picked.length} of ${PICK_COUNT} selected`;
    for (const b of grid.children) {
      const n = Number(b.dataset.n);
      const sel = picked.includes(n);
      b.classList.toggle('hidden', n > max);
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-pressed', String(sel));
      b.disabled = full && !sel;
    }
  }

  function toggle(n) {
    const i = picked.indexOf(n);
    if (i >= 0) picked.splice(i, 1);
    else if (picked.length < PICK_COUNT) picked.push(n);
    draw();
  }

  function open({ heading, numbers = [], max: gameMax, onSave: cb }) {
    max = gameMax;
    onSave = cb;
    // keep only valid, unique numbers from whatever was typed
    picked = [...new Set(numbers.map(Number))].filter(n => Number.isInteger(n) && n >= 1 && n <= max).slice(0, PICK_COUNT);
    title.textContent = heading;
    returnFocus = document.activeElement;
    draw();
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    onSave = null;
    returnFocus?.focus?.();
  }

  function save() {
    if (picked.length !== PICK_COUNT) {
      draw(`Select exactly ${PICK_COUNT} numbers before saving (${picked.length} selected).`);
      return;
    }
    const cb = onSave;
    const result = [...picked].sort((a, b) => a - b);
    close();
    cb?.(result);
  }

  grid.addEventListener('click', e => {
    const b = e.target.closest('.num');
    if (b && !b.disabled) toggle(Number(b.dataset.n));
  });
  $('#pickerClear').addEventListener('click', () => { picked = []; draw(); });
  $('#pickerCancel').addEventListener('click', close);
  $('#pickerSave').addEventListener('click', save);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('show')) close(); });

  return { open, close, isOpen: () => overlay.classList.contains('show') };
}
