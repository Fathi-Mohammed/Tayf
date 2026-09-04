'use strict';

const { app, Notification } = require('electron');

const platform = require('./platform');
const autostart = require('./autostart');
const credentials = require('../storage/credentials');
const cache = require('../storage/cache');
const log = require('../storage/log');
const { createSettings, NUDGE_KEYS } = require('../storage/settings');
const { Workspace } = require('../app/workspace');
const { JiraProvider } = require('../providers/jira');
const { OverlayWindow } = require('./overlay-window');
const { createHotkeys } = require('./hotkeys');
const { createTrayMenu } = require('./tray-menu');
const { createUpdates } = require('./updates');
const { createNudges } = require('./nudges');
const { relaunch } = require('./relaunch');
const ipc = require('./ipc');
const { NOTIFICATION_TEXT } = require('../strings');

const REFRESH_INTERVAL_MS = 60_000;
const OPEN_TIME_BUDGET_MS = 500;
const APPEARANCE_CHOICES = {
  appearanceTheme: ['tokyo-night', 'one-dark-pro', 'dracula', 'nord', 'github'],
  appearanceMode: ['system', 'dark', 'light'],
  appearanceFont: ['system', 'ping-ar']
};

function readAppearance(settings) {
  return {
    theme: settings.get('appearanceTheme'),
    mode: settings.get('appearanceMode'),
    font: settings.get('appearanceFont')
  };
}

function storedAppearance(patch) {
  const candidates = {
    appearanceTheme: patch.theme,
    appearanceMode: patch.mode,
    appearanceFont: patch.font
  };

  return Object.fromEntries(
    Object.entries(candidates).filter(([key, value]) => APPEARANCE_CHOICES[key].includes(value))
  );
}

function readNudges(settings) {
  return Object.fromEntries(
    Object.entries(NUDGE_KEYS).map(([name, key]) => [name, settings.get(key)])
  );
}

function storedNudges(patch) {
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([name]) => NUDGE_KEYS[name])
      .map(([name, value]) => [NUDGE_KEYS[name], value])
  );
}

function hotkeyChoices(accelerators) {
  return accelerators.map((accelerator) => ({
    accelerator,
    label: platform.hotkeyLabel(accelerator)
  }));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  platform.prepare();
  app.whenReady().then(start);
}

function start() {
  const settings = createSettings();
  const workspace = new Workspace({
    cache: { read: cache.readCache, write: cache.writeCache },
    log
  });

  const overlay = new OverlayWindow({ onHidden: () => {} });
  overlay.create();

  const openOverlay = (screen) => overlay.show({ state: ipc.serialiseState(workspace.state, settings.get('nudgeWorkingStatuses')), screen });
  const toggleOverlay = () => (overlay.isVisible() ? overlay.hide() : openOverlay('list'));

  const hotkeys = createHotkeys({
    platform,
    settings,
    onToggle: toggleOverlay,
    onCompose: () => openOverlay('compose')
  });

  const updates = createUpdates({ log, onChange: () => tray.update() });
  const nudges = createNudges({
    workspace,
    settings,
    log,
    onOpen: () => openOverlay('list')
  });

  const actions = {
    toggle: toggleOverlay,
    openList: () => openOverlay('list'),
    openCompose: () => openOverlay('compose'),
    openSettings: () => openOverlay('settings'),
    refresh: () => workspace.refresh(),
    quit: () => app.quit(),
    restart: () => relaunch(log),
    revealLog: () => tray.reveal(log.logFile()),
    revealConfig: () => tray.reveal(credentials.ensureFile()),
    checkUpdates: () => updates.check(),
    installUpdate: () => updates.install(),
    snoozeNudgesHour: () => {
      nudges.snoozeForAnHour();
      tray.update();
    },
    snoozeNudgesTomorrow: () => {
      nudges.snoozeUntilTomorrow();
      tray.update();
    },
    wakeNudges: () => {
      nudges.wake();
      tray.update();
    },
    readPreferences: () => ({
      toggleHotkey: hotkeys.toggle,
      composeHotkey: hotkeys.compose,
      toggleChoices: hotkeyChoices(platform.toggleHotkeys),
      composeChoices: hotkeyChoices(platform.composeHotkeys),
      autoStart: autostart.isEnabled(),
      nudges: readNudges(settings),
      appearance: readAppearance(settings)
    }),
    savePreferences: (patch) => {
      if (patch.toggleHotkey) hotkeys.choose(patch.toggleHotkey);
      if (patch.composeHotkey) hotkeys.chooseCompose(patch.composeHotkey);
      if (typeof patch.autoStart === 'boolean') autostart.setEnabled(patch.autoStart);
      if (patch.nudges) settings.remember(storedNudges(patch.nudges));
      if (patch.appearance) settings.remember(storedAppearance(patch.appearance));
      tray.update();
      return actions.readPreferences();
    },
    reportOpenTime: (milliseconds) => {
      const mark = milliseconds <= OPEN_TIME_BUDGET_MS ? 'ok' : 'slow';
      log.appendLine(`overlay opened in ${milliseconds}ms (${mark})`);
    },
    reconnect: async () => {
      connectProvider();
      const user = workspace.provider ? await workspace.provider.currentUser() : null;
      workspace.state.user = user;
      await workspace.refresh();
      return user;
    }
  };

  const tray = createTrayMenu({ workspace, hotkeys, actions, updates, nudges });

  function connectProvider() {
    const stored = credentials.read();
    workspace.useProvider(stored ? new JiraProvider(stored) : null);
  }

  workspace.on('change', (state) => {
    overlay.send('workspace:state', ipc.serialiseState(state, settings.get('nudgeWorkingStatuses')));
    tray.update();
  });

  workspace.on('failure', (failure) => {
    if (!Notification.isSupported()) return;
    try {
      new Notification({
        title: NOTIFICATION_TEXT.actionFailedTitle(failure.key),
        body: failure.message,
        silent: false
      }).show();
    } catch {}
  });

  ipc.register({ workspace, overlay, settings, actions });

  connectProvider();
  hotkeys.register();
  tray.create();
  updates.start();
  nudges.start();

  workspace.refresh();
  setInterval(() => workspace.refresh(), REFRESH_INTERVAL_MS);

  app.on('second-instance', actions.openList);
  app.on('window-all-closed', () => {});
  app.on('will-quit', () => {
    hotkeys.releaseAll();
    updates.stop();
    nudges.stop();
  });
}
