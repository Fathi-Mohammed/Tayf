import { t } from './i18n.js';
import elements from './elements.js';
import { state, isInHand } from './state.js';
import { setVisible } from './chrome.js';
import { toIsoDate } from './dates.js';
import {
  escapeHtml,
  durationSeconds,
  shortDuration,
  spentSeconds,
  workingSince,
  budgetDeadline,
  overtimeSeconds,
  clockTime,
  UNTITLED
} from './format.js';

const RING_RADIUS = 20;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function todayProgress() {
  const today = toIsoDate(new Date());
  const due = state.workspace.items.filter((item) => item.due && item.due <= today);
  return { done: due.filter((item) => item.category === 'done').length, total: due.length };
}

function remainingText(left, total) {
  if (!total) return t("مفيش حاجة معادها النهاردة");
  if (!left) return t("خلصت كل اللي عليك النهاردة");
  if (left === 1) return t("فاضل تاسك واحدة قبل ما تقفل اليوم");
  if (left === 2) return t("فاضل تاسكين قبل ما تقفل اليوم");
  if (left <= 10) return t("فاضل {0} تاسكات قبل ما تقفل اليوم", [left]);
  return t("فاضل {0} تاسك قبل ما تقفل اليوم", [left]);
}

function ringHtml(done, total) {
  const fraction = total ? done / total : 0;
  const offset = RING_LENGTH * (1 - fraction);

  return (
    '<svg class="ring" viewBox="0 0 48 48">' +
    `<circle class="rtrack" cx="24" cy="24" r="${RING_RADIUS}" />` +
    `<circle class="rfill" cx="24" cy="24" r="${RING_RADIUS}" ` +
    `stroke-dasharray="${RING_LENGTH.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />` +
    `<text class="rtext" x="24" y="25">${done}/${total}</text>` +
    '</svg>'
  );
}

export function workingItem() {
  return state.workspace.items
    .filter((item) => isInHand(item))
    .sort((first, second) => workingSince(first) - workingSince(second))[0] || null;
}

function clockHtml(item) {
  const over = overtimeSeconds(item);
  const deadline = budgetDeadline(item);

  const reading = over
    ? `+${escapeHtml(shortDuration(over))}`
    : escapeHtml(shortDuration(workingSince(item)));

  const under =
    deadline === null
      ? ''
      : `<span class="asub">${over ? t("كان المفروض تقفل") : t("المفروض تقفل")} ` +
        `${escapeHtml(clockTime(deadline))}</span>`;

  return (
    `<div class="aclock"><span class="atime${over ? ' late' : ''}" dir="ltr">${reading}</span>` +
    `${under}</div>`
  );
}

function activeHtml(item) {
  const estimate = durationSeconds(item.estimate);
  const spent = spentSeconds(item) + workingSince(item);
  const width = estimate ? Math.min(100, Math.round((spent / estimate) * 100)) : 0;
  const over = overtimeSeconds(item);

  return (
    '<div class="ahead">' +
    '<span class="adot live"></span>' +
    t("<span class=\"astate\">شغل جاري</span>") +
    `<span class="akey">${escapeHtml(item.key)}</span></div>` +
    `<div class="atitle">${escapeHtml(item.title || UNTITLED)}</div>` +
    `<div class="abar${over ? ' late' : ''}"><span style="width:${width}%"></span></div>` +
    clockHtml(item)
  );
}

export function paintSidebar() {
  if (!state.workspace.configured) {
    setVisible(elements.side, false);
    return null;
  }

  setVisible(elements.side, true, 'flex');

  const { done, total } = todayProgress();
  elements.ringwrap.innerHTML = ringHtml(done, total);
  elements.tsub.textContent = remainingText(Math.max(0, total - done), total);

  const item = workingItem();
  setVisible(elements.active, !!item);
  if (item) elements.active.innerHTML = activeHtml(item);
  return item;
}
