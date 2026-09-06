import { t } from './i18n.js';
import elements from './elements.js';
import { state, isInHand } from './state.js';
import { setVisible } from './chrome.js';
import { toIsoDate } from './dates.js';
import { todayProgress } from './progress.js';
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

function barWidth(item) {
  const estimate = durationSeconds(item.estimate);
  if (!estimate) return 0;
  return Math.min(100, Math.round(((spentSeconds(item) + workingSince(item)) / estimate) * 100));
}

function activeHtml(item) {
  const over = overtimeSeconds(item);

  return (
    '<div class="ahead">' +
    '<span class="adot live"></span>' +
    t("<span class=\"astate\">شغل جاري</span>") +
    `<span class="akey">${escapeHtml(item.key)}</span></div>` +
    `<div class="atitle">${escapeHtml(item.title || UNTITLED)}</div>` +
    `<div class="abar${over ? ' late' : ''}"><span></span></div>` +
    clockHtml(item)
  );
}

export function paintSidebar() {
  if (!state.workspace.configured) {
    setVisible(elements.side, false);
    return null;
  }

  setVisible(elements.side, true, 'flex');

  const { done, total } = todayProgress(
    state.workspace.items,
    state.workspace.closedToday,
    toIsoDate(new Date())
  );
  elements.ringwrap.innerHTML = ringHtml(done, total);
  elements.tsub.textContent = remainingText(Math.max(0, total - done), total);

  const item = workingItem();
  setVisible(elements.active, !!item);
  if (item) {
    elements.active.innerHTML = activeHtml(item);
    // CSP الطبقة (style-src 'self') بيحظر أي style جوه الماركب، فالبار كان
    // بيفضل فاضي العرض ويملا الكارت. بيتحط من هنا بعد الرسم.
    const fill = elements.active.querySelector('.abar span');
    if (fill) fill.style.width = `${barWidth(item)}%`;
  }
  return item;
}
