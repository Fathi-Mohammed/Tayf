'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');
const platform = require('./platform');

const RENDERER_ENTRY = path.join(__dirname, '..', 'renderer', 'index.html');
const PRELOAD = path.join(__dirname, '..', 'preload.js');

class OverlayWindow {
  constructor({
    onHidden,
    zoom,
    BrowserWindowClass = BrowserWindow,
    display = screen,
    platformApi = platform
  }) {
    this.onHidden = onHidden;
    this.zoom = zoom || 1;
    this.BrowserWindowClass = BrowserWindowClass;
    this.display = display;
    this.platform = platformApi;
    this.window = null;
    this.ready = false;
    this.pendingShow = null;
    this.held = 0;
  }

  isAlive(window = this.window) {
    return !!window && !window.isDestroyed();
  }

  create() {
    if (this.isAlive()) return this.window;

    const window = new this.BrowserWindowClass({
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      fullscreenable: false,
      hasShadow: false,
      title: 'Tayf',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false
      },
      ...this.platform.windowOptions()
    });
    this.window = window;
    this.ready = false;

    window.setAlwaysOnTop(true, 'screen-saver');
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.on('blur', () => {
      if (this.window === window && !this.held) this.hide();
    });
    window.on('closed', () => {
      if (this.window !== window) return;
      this.window = null;
      this.ready = false;
      this.pendingShow = null;
    });
    window.webContents.on('did-finish-load', () => {
      if (this.window !== window || !this.isAlive(window)) return;
      this.ready = true;
      // الزووم بيتصفّر مع كل تحميل، والشباك ممكن يتبني تاني، فبنرجّعه هنا.
      this.applyZoom();
      if (!this.pendingShow) return;

      const payload = this.pendingShow;
      this.pendingShow = null;
      this.send('overlay:shown', payload);
    });
    window.loadFile(RENDERER_ENTRY);
    this.platform.attachOverlay(window);

    return window;
  }

  setZoom(factor) {
    this.zoom = factor || 1;
    this.applyZoom();
  }

  applyZoom() {
    if (!this.isAlive()) return;
    this.window.webContents.setZoomFactor(this.zoom);
  }

  send(channel, payload) {
    if (this.isAlive()) {
      this.window.webContents.send(channel, payload);
    }
  }

  isVisible() {
    return this.isAlive() && this.window.isVisible();
  }

  show({ state, screen: requestedScreen }) {
    const window = this.isAlive() ? this.window : this.create();

    this.platform.rememberFocusedWindow();
    this.platform.focusOverlayApp();

    const cursor = this.display.getCursorScreenPoint();
    this.platform.setOverlayBounds(window, this.display.getDisplayNearestPoint(cursor).bounds);

    const openedAt = Date.now();
    window.show();
    window.focus();

    const payload = { openedAt, state, screen: requestedScreen };
    if (this.ready) this.send('overlay:shown', payload);
    else this.pendingShow = payload;
  }

  hold() {
    this.held += 1;
  }

  release() {
    this.held = Math.max(0, this.held - 1);
    if (!this.held && this.isVisible()) {
      this.window.show();
      this.window.focus();
    }
  }

  hide() {
    if (!this.isVisible()) return;
    this.window.hide();
    this.platform.restoreFocus();
    if (this.onHidden) this.onHidden();
  }
}

module.exports = { OverlayWindow };
