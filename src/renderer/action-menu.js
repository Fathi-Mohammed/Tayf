import { t } from './i18n.js';
import elements from './elements.js';
import { state, selectedRow } from './state.js';
import { goTo, activeScreenName } from './navigation.js';
import { escapeHtml } from './format.js';
import { rowElement } from './list-view.js';

const EDGE_GAP = 8;
const ROW_OFFSET = 4;
const FALLBACK_WIDTH = 200;
const FALLBACK_HEIGHT = 160;

export const ACTIONS = [
  { id: 'view', label: t("عرض"), shortcut: 'V' },
  { id: 'edit', label: t("تعديل"), shortcut: 'E' },
  { id: 'status', label: t("غيّر الحالة"), shortcut: 'S' },
  { id: 'jira', label: t("افتح في جيرا"), shortcut: 'O' },
  { id: 'copy', label: t("انسخ المفتاح"), shortcut: 'C' }
];

let open = false;
let highlighted = 0;

export function isOpen() {
  return open;
}

export function highlightedAction() {
  return ACTIONS[highlighted];
}

export function moveHighlight(delta) {
  highlighted = Math.max(0, Math.min(highlighted + delta, ACTIONS.length - 1));
  draw();
}

function draw() {
  elements.actions.innerHTML = ACTIONS.map(
    (action, index) =>
      `<div class="act${index === highlighted ? ' on' : ''}" data-id="${action.id}">` +
      `${escapeHtml(action.label)}<i>${action.shortcut}</i></div>`
  ).join('');
  elements.actions.style.display = 'block';
}

function place() {
  const row = rowElement(state.selectedIndex);
  const panel = elements.panel.getBoundingClientRect();
  const anchor = row ? row.getBoundingClientRect() : panel;
  const width = elements.actions.offsetWidth || FALLBACK_WIDTH;
  const height = elements.actions.offsetHeight || FALLBACK_HEIGHT;

  const isLtr = document.documentElement.dir === 'ltr';
  const rightSide = panel.right + EDGE_GAP;
  const leftSide = panel.left - width - EDGE_GAP;
  let left = isLtr ? rightSide : leftSide;
  if (left < EDGE_GAP || left + width > window.innerWidth - EDGE_GAP) {
    left = isLtr ? leftSide : rightSide;
  }

  elements.actions.style.left = `${Math.max(
    EDGE_GAP,
    Math.min(left, window.innerWidth - width - EDGE_GAP)
  )}px`;
  elements.actions.style.top = `${Math.max(
    EDGE_GAP,
    Math.min(anchor.top - ROW_OFFSET, window.innerHeight - height - EDGE_GAP)
  )}px`;
}

export function openMenu() {
  if (activeScreenName() !== 'tasks' || !state.rows.length) return;
  open = true;
  highlighted = 0;
  draw();
  place();
}

export function closeMenu() {
  if (!open) return;
  open = false;
  elements.actions.style.display = 'none';
}

export async function runAction(id) {
  const item = selectedRow();
  closeMenu();
  if (!item) return;

  if (id === 'view') await goTo('itemView', { item });
  else if (id === 'edit') await goTo('compose', { intent: 'edit', item });
  else if (id === 'status') await goTo('transitions', { item });
  else if (id === 'jira') {
    window.tayf.openItem(item.key);
    window.tayf.close();
  } else if (id === 'copy') {
    try {
      await navigator.clipboard.writeText(item.key);
    } catch {
      window.tayf.close();
      return;
    }
    window.tayf.close();
  }
}

elements.actions.addEventListener('mousedown', (event) => {
  const action = event.target.closest('.act');
  if (!action) return;
  event.preventDefault();
  runAction(action.dataset.id);
});
