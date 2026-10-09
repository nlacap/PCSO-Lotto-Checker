// The status box under the Compare button.

import { $, el } from './dom.js';

/**
 * @param {'info'|'success'|'warn'|'error'} kind
 * @param {string} text
 * @param {string[]} [items] optional bullet list (e.g. every validation problem)
 */
export function setStatus(kind, text, items = []) {
  const box = $('#status');
  if (!box) return;
  box.className = 'status ' + kind;
  box.replaceChildren(el('div', {}, text));
  if (items.length) box.append(el('ul', {}, items.map(t => el('li', {}, t))));
}
