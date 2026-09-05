import { setWorkspace } from './state.js';
import { registerScreen, goTo, repaint } from './navigation.js';
import { setFlash } from './chrome.js';
import { installKeyboard } from './keyboard.js';
import { installBoard, adoptPreferences } from './board.js';
import { taskListScreen } from './screens/task-list.js';
import { transitionsScreen } from './screens/transitions.js';
import { transitionFormScreen } from './screens/transition-form.js';
import { composeScreen } from './screens/compose.js';
import { itemViewScreen } from './screens/item-view.js';
import { settingsScreen, showTab } from './screens/settings.js';
import { applyPreferences } from './appearance.js';

const OPEN_SCREEN = {
  settings: () => goTo('settings'),
  compose: () => goTo('compose', { intent: 'create', prefillTitle: '' }),
  list: () => goTo('tasks')
};

[
  taskListScreen,
  transitionsScreen,
  transitionFormScreen,
  composeScreen,
  itemViewScreen,
  settingsScreen
].forEach(registerScreen);

function relabelForMac() {
  if (window.tayf.platform !== 'darwin') return;
  document.querySelectorAll('kbd').forEach((element) => {
    element.textContent = element.textContent.replace(/^Ctrl/, '⌘');
  });
}

function reportOpenTime(openedAt) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.tayf.reportOpenTime(Date.now() - openedAt));
  });
}

export function handleState(next) {
  setWorkspace(next);
  repaint();
}

export function handleShown(payload) {
  if (payload.state) setWorkspace(payload.state);
  setFlash('', '');

  const requested = payload.state && !payload.state.configured ? 'settings' : payload.screen;
  (OPEN_SCREEN[requested] || OPEN_SCREEN.list)();
  reportOpenTime(payload.openedAt);
}

export async function startApp(preferences) {
  relabelForMac();
  document.getElementById('actionkey').textContent =
    document.documentElement.dir === 'ltr' ? '→' : '←';
  installKeyboard();

  installBoard(repaint);

  applyPreferences(preferences);
  adoptPreferences(preferences);

  const next = await window.tayf.state();
  setWorkspace(next);
  const languageTab = window.sessionStorage.getItem('language-settings');
  if (languageTab) {
    window.sessionStorage.removeItem('language-settings');
    await goTo('settings');
    showTab(languageTab);
    document.getElementById('slanguage-trigger').focus();
    return;
  }
  return goTo('tasks');
}
