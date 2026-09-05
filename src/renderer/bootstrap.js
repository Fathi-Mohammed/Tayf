import { setLanguage, translateDocument } from './i18n.js';

// Subscribe before awaiting preferences: Electron can show the overlay while
// screen modules are still loading. Replay the latest events once they are ready.
let app = null;
let pendingState = null;
let pendingShown = null;
window.tayf.onState((state) => {
  if (app) app.handleState(state);
  else pendingState = state;
});
window.tayf.onShown((payload) => {
  if (app) app.handleShown(payload);
  else pendingShown = payload;
});

// Load the saved language before screen modules initialize their labels.
const preferences = await window.tayf.readPreferences();
setLanguage(preferences.language);
translateDocument();
const screens = await import('./app.js');
await screens.startApp(preferences);
app = screens;
if (pendingShown) app.handleShown(pendingShown);
if (pendingState) app.handleState(pendingState);
