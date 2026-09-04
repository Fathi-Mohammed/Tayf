export const THEMES = [
  { id: 'tokyo-night', label: 'Tokyo Night', hint: 'هادي بلمسات زرقاء وبنفسجية' },
  { id: 'one-dark-pro', label: 'One Dark Pro', hint: 'دافئ ومتوازن ومريح للعين' },
  { id: 'dracula', label: 'Dracula', hint: 'ألوان واضحة وحيوية' },
  { id: 'nord', label: 'Nord', hint: 'درجات باردة وهادئة' },
  { id: 'github', label: 'GitHub', hint: 'بسيط ونظيف وعالي التباين' }
];

export const MODES = ['system', 'dark', 'light'];
export const FONTS = ['system', 'ping-ar'];

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
let current = null;

function allowed(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

export function normaliseAppearance(appearance = {}) {
  return {
    theme: allowed(appearance.theme, THEMES.map((theme) => theme.id), 'tokyo-night'),
    mode: allowed(appearance.mode, MODES, 'system'),
    font: allowed(appearance.font, FONTS, 'system')
  };
}

export function applyAppearance(appearance) {
  current = normaliseAppearance(appearance);
  const resolvedMode = current.mode === 'system' ? (systemDark.matches ? 'dark' : 'light') : current.mode;
  const root = document.documentElement;
  root.dataset.theme = current.theme;
  root.dataset.colorMode = resolvedMode;
  root.dataset.font = current.font;
  return current;
}

systemDark.addEventListener('change', () => {
  if (current && current.mode === 'system') applyAppearance(current);
});
