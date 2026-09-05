import { t } from './i18n.js';
import elements from './elements.js';
import { state } from './state.js';
import { escapeHtml, relativeTime } from './format.js';

const FLASH_TIMEOUT_MS = 8000;

const SCREEN_PARTS = {
  tasks: { roots: ['list', 'msg'], footer: 'foot', bar: true, board: true },
  transitions: { roots: ['list', 'msg'], footer: 'foot', bar: true, board: false },
  transitionForm: { roots: ['finish'], footer: 'footf', bar: false, board: false },
  compose: { roots: ['create'], footer: 'footc', bar: true, board: false },
  edit: { roots: ['create'], footer: 'footd', bar: true, board: false },
  itemView: { roots: ['view'], footer: 'footv', bar: false, board: false },
  settings: { roots: ['settings'], footer: 'foots', bar: false, board: false }
};

const ALL_ROOTS = ['list', 'msg', 'create', 'view', 'settings', 'finish'];
const ALL_FOOTERS = ['foot', 'footc', 'footd', 'footv', 'foots', 'footf'];

let flash = null;
let flashTimer = null;
let painted = '';

export function setVisible(element, visible, display = 'block') {
  element.style.display = visible ? display : 'none';
}

export function showLayout(layoutName) {
  const layout = SCREEN_PARTS[layoutName];
  ALL_ROOTS.forEach((id) => setVisible(elements[id], false));
  ALL_FOOTERS.forEach((id) => setVisible(elements[id], false));

  const onBoard = !!layout.board && state.workspace.configured;
  elements.stage.classList.toggle('wide', onBoard);
  setVisible(elements.bar, layout.bar, 'flex');
  setVisible(elements.boardbar, onBoard, 'flex');
  if (!onBoard) setVisible(elements.side, false);
  setVisible(elements[layout.footer], true, 'flex');
  layout.roots.forEach((id) => setVisible(elements[id], true));
}

export function setContext(html) {
  elements.ctx.innerHTML = html || '';
  setVisible(elements.ctx, !!html);
}

const TOAST_ICONS = {
  good:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.4 3 3 6-6.8" /></svg>',
  bad:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round"><circle cx="8" cy="8" r="6" /><path d="M8 4.8v3.6" />' +
    '<circle cx="8" cy="11.1" r=".85" fill="currentColor" stroke="none" /></svg>',
  pending: '<span class="spin"></span>'
};

TOAST_ICONS.warn = TOAST_ICONS.bad;

function toastHtml(toast) {
  return (
    `<div class="toast ${toast.kind}"` +
    `${toast.dismiss ? ` data-dismiss="${toast.dismiss}"` : ''}>` +
    `<span class="tico">${TOAST_ICONS[toast.kind] || ''}</span>` +
    '<div class="tbody">' +
    `<div class="ttext">${toast.html}</div>` +
    (toast.sub ? `<div class="tsub">${toast.sub}</div>` : '') +
    (toast.hint ? `<div class="thint">${toast.hint}</div>` : '') +
    '</div></div>'
  );
}

export function setFlash(html, className) {
  clearTimeout(flashTimer);
  flash = html ? { html, className: className || '' } : null;
  if (flash && className !== 'pending') {
    flashTimer = setTimeout(() => {
      flash = null;
      paintBanners();
    }, FLASH_TIMEOUT_MS);
  }
  paintBanners();
}

export function paintBanners() {
  const { error, failure } = state.workspace;
  const toasts = [];

  if (error) toasts.push({ kind: 'warn', html: escapeHtml(error) });

  if (failure) {
    const key = failure.key ? `<b>${escapeHtml(failure.key)}</b> ` : '';
    toasts.push({
      kind: 'bad',
      html: t("{0}الأكشن ده ماتنفذش", [key]),
      sub: escapeHtml(failure.message),
      hint: t("دوس هنا تقفل الرسالة · التاسك رجعت لحالتها الأصلية"),
      dismiss: 'failure'
    });
  }

  if (flash) {
    toasts.push({
      kind: flash.className === 'pending' ? 'pending' : 'good',
      html: flash.html
    });
  }

  const markup = toasts.map(toastHtml).join('');
  if (markup !== painted) {
    painted = markup;
    elements.toasts.innerHTML = markup;
  }
  setVisible(elements.toasts, !!toasts.length, 'flex');
}

export function setFooterMeta(id, text) {
  elements[id].textContent = text || '';
}

export function itemCountMeta() {
  return t("{0} تاسك · {1}", [state.rows.length, relativeTime(state.workspace.fetchedAt)]);
}
