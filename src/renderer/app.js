import { setWorkspace } from './state.js';
import { registerScreen, goTo, repaint } from './navigation.js';
import { setFlash } from './chrome.js';
import { installKeyboard } from './keyboard.js';
import { taskListScreen } from './screens/task-list.js';
import { transitionsScreen } from './screens/transitions.js';
import { transitionFormScreen } from './screens/transition-form.js';
import { composeScreen } from './screens/compose.js';
import { itemViewScreen } from './screens/item-view.js';
import { settingsScreen } from './screens/settings.js';
import { applyAppearance } from './appearance.js';

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

window.tayf.onState((next) => {
  setWorkspace(next);
  repaint();
});

window.tayf.onShown((payload) => {
  if (payload.state) setWorkspace(payload.state);
  setFlash('', '');

  const requested = payload.state && !payload.state.configured ? 'settings' : payload.screen;
  (OPEN_SCREEN[requested] || OPEN_SCREEN.list)();
  reportOpenTime(payload.openedAt);
});

relabelForMac();
installKeyboard();

window.tayf.readPreferences().then((preferences) => applyAppearance(preferences.appearance));

window.tayf.state().then((next) => {
  setWorkspace(next);
  return goTo('tasks');
});
