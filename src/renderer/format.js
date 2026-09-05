import { t, getLocale } from './i18n.js';
const TYPE_BADGES = [
  { match: (name) => name.startsWith('sub') || name.includes('sub-task'), badge: 'SUB', className: 'ty-sub' },
  { match: (name) => name.includes('bug'), badge: 'BUG', className: 'ty-bug' },
  { match: (name) => name.includes('story'), badge: 'STORY', className: 'ty-story' },
  { match: (name) => name.includes('epic'), badge: 'EPIC', className: 'ty-epic' },
  { match: (name) => name.includes('enhance'), badge: 'ENH', className: '' },
  { match: (name) => name.includes('meeting'), badge: 'MTG', className: '' }
];

const DEFAULT_BADGE = { badge: 'TASK', className: '' };
const FILLED_SEGMENTS = { new: 1, indeterminate: 2, done: 3 };
const TOTAL_SEGMENTS = 3;

export const UNTITLED = t("(بدون عنوان)");
export const NO_STATUS = '—';

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function typeBadge(typeName) {
  const name = String(typeName || '').toLowerCase();
  const found = TYPE_BADGES.find((candidate) => candidate.match(name));
  return found ? { badge: found.badge, className: found.className } : DEFAULT_BADGE;
}

export function boardLabel(item) {
  const boards = item.boards || [];
  if (!boards.length) return { short: '', full: '' };

  const projectPrefix = String(item.key || '').split('-')[0].replace(/[^A-Za-z0-9_]/g, '');
  const redundantPrefix = projectPrefix
    ? new RegExp(`^${projectPrefix}[ ]*[-–—:·][ ]*`, 'i')
    : null;

  const names = boards.map((board) => {
    const name = String(board.name || '');
    return redundantPrefix ? name.replace(redundantPrefix, '') : name;
  });

  return {
    short: names[0] + (names.length > 1 ? ` +${names.length - 1}` : ''),
    full: boards.map((board) => board.name).join('  ·  ')
  };
}

export function progressTrack(category) {
  const filled = FILLED_SEGMENTS[category] || 1;
  let html = '<span class="track">';
  for (let segment = 1; segment <= TOTAL_SEGMENTS; segment += 1) {
    html += `<span class="seg${segment <= filled ? ' f' : ''}"></span>`;
  }
  return `${html}</span>`;
}

export function relativeTime(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return t("الآن");
  if (seconds < 3600) return t("من {0}د", [Math.round(seconds / 60)]);
  return t("من {0}س", [Math.round(seconds / 3600)]);
}

const PRIORITY_LEVELS = [
  { match: /highest|blocker|critical|أعلى|حرج|عاجل/, label: t("عاجلة"), className: 'pr-top' },
  { match: /lowest|أدنى|trivial/, label: t("أدنى"), className: 'pr-low' },
  { match: /high|عالي|مرتفع|major/, label: t("عالية"), className: 'pr-high' },
  { match: /medium|normal|متوسط|عادي/, label: t("متوسطة"), className: 'pr-mid' },
  { match: /low|منخفض|minor/, label: t("منخفضة"), className: 'pr-low' }
];

const DURATION_UNITS = { w: 144000, d: 28800, h: 3600, m: 60 };
const DURATION_PART = /(\d+(?:\.\d+)?)\s*([wdhm])/g;
const DAY_SECONDS = 86400;
const HOUR_SECONDS = 3600;

export function priorityBadge(priority) {
  const name = String(priority || '').toLowerCase();
  if (!name) return null;
  const level = PRIORITY_LEVELS.find((candidate) => candidate.match.test(name));
  return level
    ? { label: level.label, className: level.className }
    : { label: priority, className: 'pr-mid' };
}

export function durationSeconds(text) {
  let total = 0;
  for (const part of String(text || '').toLowerCase().matchAll(DURATION_PART)) {
    total += Number(part[1]) * DURATION_UNITS[part[2]];
  }
  return total;
}

export function shortDuration(seconds) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

export function coarseDuration(seconds) {
  const days = Math.floor(seconds / DAY_SECONDS);
  const hours = Math.floor((seconds % DAY_SECONDS) / HOUR_SECONDS);
  if (days && hours) return `${days}d ${hours}h`;
  if (days) return `${days}d`;
  return `${Math.max(1, hours)}h`;
}

export function overdueSeconds(due, now = Date.now()) {
  if (!due) return 0;
  const deadline = new Date(`${due}T23:59:59`).getTime();
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, Math.round((now - deadline) / 1000));
}

export function spentSeconds(item) {
  return item.spentSeconds || durationSeconds(item.spent);
}

export function remainingSeconds(item) {
  const estimate = durationSeconds(item.estimate);
  if (!estimate) return 0;
  return Math.max(0, estimate - spentSeconds(item));
}

export function workingSince(item, now = Date.now()) {
  const started = Date.parse(item.categoryChangedAt || '');
  if (!started) return 0;
  return Math.max(0, Math.round((now - started) / 1000));
}

export function budgetDeadline(item) {
  const started = Date.parse(item.categoryChangedAt || '');
  if (!started || !durationSeconds(item.estimate)) return null;
  return started + remainingSeconds(item) * 1000;
}

export function overtimeSeconds(item, now = Date.now()) {
  const deadline = budgetDeadline(item);
  if (deadline === null) return 0;
  return Math.max(0, Math.round((now - deadline) / 1000));
}

export function clockTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString(`${getLocale()}-u-nu-latn`, {
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}
