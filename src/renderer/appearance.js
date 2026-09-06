import { t } from './i18n.js';
// بيمسك المظهر على <html>: data-appearance (dark|light) و data-theme و data-font.
// "زي السيستم" بيتحل هنا مش في الـ CSS — كده بلوك الألوان الفاتح متكتب مرة واحدة.

const SYSTEM_LIGHT = window.matchMedia('(prefers-color-scheme: light)');

// الأسامي المعروضة عايشة في index.html على أزرار المجموعة، فهنا القيم بس.
export const APPEARANCES = ['system', 'light', 'dark'];

export const THEMES = [
  { value: 'tokyo', label: 'Tokyo Night' },
  { value: 'one-dark', label: 'One Dark Pro' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'nord', label: 'Nord' },
  { value: 'github', label: 'GitHub' }
];

export const FONTS = [
  { value: 'default', label: t("الافتراضي · Cairo و Inter") },
  { value: 'readex', label: 'Readex Pro' },
  { value: 'system', label: t("خط الجهاز") }
];

export const SCALES = [
  { value: 0.9, label: t("صغيرة · ٩٠٪") },
  { value: 1, label: t("عادية · ١٠٠٪") },
  { value: 1.15, label: t("كبيرة · ١١٥٪") },
  { value: 1.3, label: t("أكبر · ١٣٠٪") }
];

export const DEFAULT_THEME = 'tokyo';
export const DEFAULT_FONT = 'default';

let preference = 'system';

function resolve() {
  if (preference === 'light' || preference === 'dark') return preference;
  return SYSTEM_LIGHT.matches ? 'light' : 'dark';
}

function pick(options, next, fallback) {
  return options.some((option) => option.value === next) ? next : fallback;
}

export function applyAppearance(next) {
  preference = APPEARANCES.includes(next) ? next : 'system';
  document.documentElement.dataset.appearance = resolve();
  return preference;
}

export function applyTheme(next) {
  const chosen = pick(THEMES, next, DEFAULT_THEME);
  document.documentElement.dataset.theme = chosen;
  return chosen;
}

export function applyFont(next) {
  const chosen = pick(FONTS, next, DEFAULT_FONT);
  document.documentElement.dataset.font = chosen;
  return chosen;
}

// بترجّع اللي اتطبّق فعلاً مش اللي اتخزّن — الإعدادات القديمة ممكن يكون فيها
// ثيم اتشال، وساعتها القايمة لازم تورّي البديل اللي بنعرضه مش قيمة مش موجودة.
export function applyPreferences(preferences) {
  return {
    appearance: applyAppearance(preferences.appearance),
    theme: applyTheme(preferences.theme),
    font: applyFont(preferences.font)
  };
}

SYSTEM_LIGHT.addEventListener('change', () => {
  if (preference === 'system') document.documentElement.dataset.appearance = resolve();
});
