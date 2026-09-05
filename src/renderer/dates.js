import { t, getLocale } from './i18n.js';
const WEEKDAYS = {
  الاحد: 0, الأحد: 0, الحد: 0, sun: 0, sunday: 0,
  الاتنين: 1, الإتنين: 1, الاثنين: 1, الإثنين: 1, mon: 1, monday: 1,
  التلات: 2, الثلات: 2, الثلاثاء: 2, tue: 2, tuesday: 2,
  الاربع: 3, الأربع: 3, الاربعاء: 3, الأربعاء: 3, wed: 3, wednesday: 3,
  الخميس: 4, thu: 4, thursday: 4,
  الجمعة: 5, الجمعه: 5, fri: 5, friday: 5,
  السبت: 6, sat: 6, saturday: 6
};

const TODAY_WORDS = /^(النهارده|النهاردة|اليوم|today)$/;
const TOMORROW_WORDS = /^(بكرة|بكره|غدا|غدًا|tomorrow)$/;
const DAY_AFTER_WORDS = /^(بعد بكرة|بعد بكره|day after tomorrow)$/;
const DAYS_AHEAD = /^\+?(\d{1,3})$/;
const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DAY_MONTH = /^(\d{1,2})[/-](\d{1,2})$/;
const MINUTES_ONLY = /^\d+(\.\d+)?$/;
const JIRA_DURATION = /^(\d+(\.\d+)?\s*[wdhm]\s*)+$/;

const UNPARSED_DATE = t("مش فاهم التاريخ ده");
const INVALID_DATE = t("تاريخ غير صحيح");
const UNPARSED_ESTIMATE = t("اكتب رقم (دقايق) أو 4h أو 2d أو 1d 4h");

export function toIsoDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDate(date) {
  try {
    return date.toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return toIsoDate(date);
  }
}

export function parseDueDate(input, now = new Date()) {
  const text = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return { ok: true, value: null, label: '' };

  const today = new Date(now);
  today.setHours(12, 0, 0, 0);

  const daysFromToday = (days) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return date;
  };

  const resolved = (date) =>
    Number.isNaN(date.getTime())
      ? { ok: false, value: null, label: INVALID_DATE }
      : { ok: true, value: toIsoDate(date), label: formatDate(date) };

  if (TODAY_WORDS.test(text)) return resolved(today);
  if (TOMORROW_WORDS.test(text)) return resolved(daysFromToday(1));
  if (DAY_AFTER_WORDS.test(text)) return resolved(daysFromToday(2));

  const ahead = text.match(DAYS_AHEAD);
  if (ahead) return resolved(daysFromToday(parseInt(ahead[1], 10)));

  if (Object.hasOwn(WEEKDAYS, text)) {
    const offset = (WEEKDAYS[text] - today.getDay() + 7) % 7;
    return resolved(daysFromToday(offset === 0 ? 7 : offset));
  }

  const iso = text.match(ISO);
  if (iso) return resolved(new Date(+iso[1], +iso[2] - 1, +iso[3], 12));

  const dayMonth = text.match(DAY_MONTH);
  if (dayMonth) {
    return resolved(new Date(today.getFullYear(), +dayMonth[2] - 1, +dayMonth[1], 12));
  }

  return { ok: false, value: null, label: UNPARSED_DATE };
}

export function parseEstimate(input) {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return { ok: true, value: null, label: '' };
  if (MINUTES_ONLY.test(text)) return { ok: true, value: `${text}m`, label: `${text}m` };
  if (JIRA_DURATION.test(text)) {
    const value = text.replace(/\s+/g, ' ').trim();
    return { ok: true, value, label: value };
  }
  return { ok: false, value: null, label: UNPARSED_ESTIMATE };
}

export const DATE_WORDS = [
  t("النهاردة"), t("بكرة"), t("بعد بكرة"),
  t("الأحد"), t("الاتنين"), t("التلات"), t("الأربع"), t("الخميس"), t("الجمعة"), t("السبت")
];

export const QUICK_DATES = [
  { key: '1', label: t("النهاردة") },
  { key: '2', label: t("بكرة") },
  { key: '3', label: t("بعد بكرة") },
  { key: '4', label: t("الخميس") },
  { key: '5', label: '+7' }
];
