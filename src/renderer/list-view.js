import elements from './elements.js';
import { state, clampSelection } from './state.js';
import { setVisible } from './chrome.js';
import { escapeHtml, typeBadge, boardLabel, progressTrack, UNTITLED, NO_STATUS } from './format.js';

export function itemRowHtml(item, selected) {
  const category = item.category || 'new';
  const badge = typeBadge(item.type);
  const board = boardLabel(item);

  return (
    `<div class="row c-${category}${selected ? ' on' : ''}">` +
    `<span class="key">${escapeHtml(item.key)}</span>` +
    `<span class="ty ${badge.className}">${badge.badge}</span>` +
    `<span class="title">${escapeHtml(item.title || UNTITLED)}</span>` +
    `<span class="brd" title="${escapeHtml(board.full)}">${escapeHtml(board.short)}</span>` +
    `<span class="state">${progressTrack(category)}` +
    `<span class="stname">${escapeHtml(item.status || NO_STATUS)}</span></span></div>`
  );
}

export function transitionRowHtml(transition, index, selected, needsDetails) {
  const category = transition.toCategory || 'new';
  const hint = needsDetails ? ' <span class="dim">· هيسأل عن تفاصيل</span>' : '';

  return (
    `<div class="row c-${category}${selected ? ' on' : ''}">` +
    `<span class="key">${index + 1}</span>` +
    `<span class="title">${escapeHtml(transition.name)}${hint}</span>` +
    `<span class="state">${progressTrack(category)}` +
    `<span class="stname">${escapeHtml(transition.toStatus)}</span></span></div>`
  );
}

export function paintRows(rows, emptyMessage, rowHtml) {
  state.rows = rows;
  clampSelection();

  if (!rows.length) {
    setVisible(elements.list, false);
    setVisible(elements.msg, true);
    elements.msg.innerHTML = `<span class="dim">${escapeHtml(emptyMessage)}</span>`;
    return;
  }

  setVisible(elements.msg, false);
  setVisible(elements.list, true);
  elements.list.innerHTML = rows
    .map((row, index) => rowHtml(row, index, index === state.selectedIndex))
    .join('');

  const selected = elements.list.querySelector('.row.on');
  if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: 'nearest' });
}

export function moveSelection(delta) {
  state.selectedIndex = Math.max(
    0,
    Math.min(state.selectedIndex + delta, state.rows.length - 1)
  );
}
