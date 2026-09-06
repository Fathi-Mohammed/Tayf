'use strict';

const path = require('path');
const { app, Tray, Menu, nativeTheme, shell } = require('electron');
const platform = require('./platform');
const autostart = require('./autostart');
const { TRAY_TEXT, getLocale } = require('../strings');

const ASSETS = path.join(__dirname, '..', '..', 'assets');

function appTitle() {
  return TRAY_TEXT.appTitle(app.getVersion(), !app.isPackaged);
}

function headline(state) {
  if (!state.configured) return TRAY_TEXT.needsSetup;
  if (state.error) return TRAY_TEXT.connectionProblem;
  return TRAY_TEXT.itemCount(state.items.length);
}

function withHotkey(label, accelerator) {
  return accelerator ? `${label}  (${platform.hotkeyLabel(accelerator)})` : label;
}

function clockTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function createTrayMenu({ workspace, hotkeys, actions, updates, nudges }) {
  let tray = null;

  function nudgeItems() {
    const until = nudges ? nudges.snoozedUntil() : null;
    const asleep = !!until && until > Date.now();

    return [
      ...(asleep
        ? [{ label: TRAY_TEXT.nudgeSnoozedUntil(clockTime(until)), enabled: false }]
        : []),
      { label: TRAY_TEXT.nudgeSnoozeHour, click: actions.snoozeNudgesHour },
      { label: TRAY_TEXT.nudgeSnoozeTomorrow, click: actions.snoozeNudgesTomorrow },
      { label: TRAY_TEXT.nudgeWake, click: actions.wakeNudges, enabled: asleep }
    ];
  }

  function updateItems() {
    if (!updates || !updates.supported) return [];
    const { checking, downloading, ready, version } = updates.state;

    if (ready) return [{ label: TRAY_TEXT.updateReady(version), click: actions.installUpdate }];
    if (downloading) return [{ label: TRAY_TEXT.downloadingUpdate, enabled: false }];
    if (checking) return [{ label: TRAY_TEXT.checkingUpdates, enabled: false }];
    return [{ label: TRAY_TEXT.checkUpdates, click: actions.checkUpdates }];
  }

  function template() {
    const state = workspace.state;
    const head = headline(state);

    return [
      { label: `${appTitle()} — ${head}`, enabled: false },
      { type: 'separator' },
      { label: withHotkey(TRAY_TEXT.open, hotkeys.toggle), click: actions.openList },
      { label: withHotkey(TRAY_TEXT.newItem, hotkeys.compose), click: actions.openCompose },
      { label: TRAY_TEXT.refreshNow, click: actions.refresh },
      { type: 'separator' },
      {
        label: TRAY_TEXT.hotkey,
        submenu: platform.toggleHotkeys.map((accelerator) => ({
          label: platform.hotkeyLabel(accelerator),
          type: 'radio',
          checked: hotkeys.toggle === accelerator,
          click: () => {
            hotkeys.choose(accelerator);
            update();
          }
        }))
      },
      { label: TRAY_TEXT.nudges, submenu: nudgeItems() },
      {
        label: TRAY_TEXT[platform.autoStartLabel],
        type: 'checkbox',
        checked: autostart.isEnabled(),
        click: (item) => {
          autostart.setEnabled(item.checked);
          update();
        }
      },
      { type: 'separator' },
      { label: TRAY_TEXT.settings, click: actions.openSettings },
      { label: TRAY_TEXT.errorLog, click: actions.revealLog },
      { label: TRAY_TEXT.openConfigFile, click: actions.revealConfig },
      ...updateItems(),
      { label: TRAY_TEXT.restart, click: actions.restart },
      { label: TRAY_TEXT.quit, click: actions.quit }
    ];
  }

  function update() {
    if (!tray || tray.isDestroyed()) return;
    const suffix = hotkeys.toggle ? ` · ${platform.hotkeyLabel(hotkeys.toggle)}` : '';
    tray.setToolTip(`${appTitle()} — ${headline(workspace.state)}${suffix}`);
    tray.setContextMenu(Menu.buildFromTemplate(template()));
  }

  function create() {
    tray = new Tray(platform.trayIcon(ASSETS));
    tray.on('click', actions.toggle);
    nativeTheme.on('updated', () => {
      if (tray && !tray.isDestroyed()) tray.setImage(platform.trayIcon(ASSETS));
    });
    update();
    return tray;
  }

  return { create, update, reveal: (filePath) => shell.showItemInFolder(filePath) };
}

module.exports = { createTrayMenu };
