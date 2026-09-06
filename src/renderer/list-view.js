import { t } from './i18n.js';
import elements from './elements.js';
import { state, clampSelection, isInHand } from './state.js';
import { setVisible } from './chrome.js';
import {
  escapeHtml,
  typeBadge,
  workingSince,
  overtimeSeconds,
  boardLabel,
  priorityBadge,
  progressTrack,
  shortDuration,
  coarseDuration,
  overdueSeconds,
  remainingSeconds,
  spentSeconds,
  UNTITLED,
  NO_STATUS
} from './format.js';

const NO_TIME = '–';
const PLAY = '&#9654;';

function timeCell(item) {
  if (isInHand(item)) {
    const over = overtimeSeconds(item);
    if (over) return { tone: 'late', html: `+${escapeHtml(shortDuration(over))}` };
    return { tone: 'run', html: `<b>${PLAY}</b> ${escapeHtml(shortDuration(workingSince(item)))}` };
  }
  if (item.category === 'done') {
    const spent = spentSeconds(item);
    return { tone: 'was', html: spent ? escapeHtml(shortDuration(spent)) : NO_TIME };
  }
  const late = overdueSeconds(item.due);
  if (late) return { tone: 'late', html: `+${escapeHtml(coarseDuration(late))}` };

  const left = remainingSeconds(item);
  if (left) return { tone: '', html: `${escapeHtml(shortDuration(left))} left` };
  return { tone: 'none', html: NO_TIME };
}

function roomyRowHtml(item, classes, index, badge, priority, time) {
  const board = boardLabel(item);
  const meta = [
    `<span class="mkey">${escapeHtml(item.key)}</span>`,
    `<span class="ty ${badge.className}">${badge.badge}</span>`,
    board.short ? `<span class="mbrd" title="${escapeHtml(board.full)}">${escapeHtml(board.short)}</span>` : '',
    priority ? `<span class="mpr ${priority.className}">${escapeHtml(priority.label)}</span>` : ''
  ]
    .filter(Boolean)
    .join('<span class="mdot">·</span>');

  return (
    `<div class="${classes} roomy" data-i="${index}">` +
    '<span class="lines">' +
    `<span class="title">${escapeHtml(item.title || UNTITLED)}</span>` +
    `<span class="meta">${meta}</span></span>` +
    `<span class="when ${time.tone}" dir="ltr">${time.html}</span>` +
    `<span class="pill">${escapeHtml(item.status || NO_STATUS)}</span></div>`
  );
}

function compactRowHtml(item, classes, index, badge, priority, time) {
  const category = item.category || 'new';

  return (
    `<div class="${classes}" data-i="${index}">` +
    `<span class="key">${escapeHtml(item.key)}</span>` +
    `<span class="ty ${badge.className}">${badge.badge}</span>` +
    `<span class="title">${escapeHtml(item.title || UNTITLED)}</span>` +
    `<span class="pr ${priority ? priority.className : 'pr-none'}">` +
    `${priority ? escapeHtml(priority.label) : ''}</span>` +
    `<span class="when ${time.tone}" dir="ltr">${time.html}</span>` +
    `<span class="state">${progressTrack(category)}` +
    `<span class="stname">${escapeHtml(item.status || NO_STATUS)}</span></span></div>`
  );
}

export function itemRowHtml(item, selected, index) {
  const category = item.category || 'new';
  const classes = `row c-${category}${selected ? ' on' : ''}`;
  const badge = typeBadge(item.type);
  const priority = priorityBadge(item.priority);
  const time = timeCell(item);

  return state.view === 'roomy'
    ? roomyRowHtml(item, classes, index, badge, priority, time)
    : compactRowHtml(item, classes, index, badge, priority, time);
}

export function transitionRowHtml(transition, index, selected, needsDetails) {
  const category = transition.toCategory || 'new';
  const hint = needsDetails ? t(" <span class=\"dim\">· هيسأل عن تفاصيل</span>") : '';

  return (
    `<div class="row c-${category}${selected ? ' on' : ''}" data-i="${index}">` +
    `<span class="key">${index + 1}</span>` +
    `<span class="title">${escapeHtml(transition.name)}${hint}</span>` +
    `<span class="state">${progressTrack(category)}` +
    `<span class="stname">${escapeHtml(transition.toStatus)}</span></span></div>`
  );
}

function sectionHtml(section) {
  return (
    `<div class="sect${section.tone ? ` ${section.tone}` : ''}">` +
    `<span class="sname">${escapeHtml(section.label)}</span>` +
    '<span class="sline"></span>' +
    `<span class="scount">${section.count}</span></div>`
  );
}

export function rowElement(index) {
  return elements.list.querySelector(`.row[data-i="${index}"]`);
}

export function paintRows(rows, emptyMessage, rowHtml, headers) {
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
    .map((row, index) => {
      const header = headers && headers.get(index);
      return (
        (header ? sectionHtml(header) : '') +
        rowHtml(row, index, index === state.selectedIndex)
      );
    })
    .join('');

  const selected = rowElement(state.selectedIndex);
  if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: 'nearest' });
}

export function moveSelection(delta) {
  state.selectedIndex = Math.max(
    0,
    Math.min(state.selectedIndex + delta, state.rows.length - 1)
  );
}
