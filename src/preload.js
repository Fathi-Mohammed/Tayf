'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tayf', {
  platform: process.platform,

  onShown: (handler) => ipcRenderer.on('overlay:shown', (_event, payload) => handler(payload)),
  onState: (handler) => ipcRenderer.on('workspace:state', (_event, state) => handler(state)),
  state: () => ipcRenderer.invoke('workspace:state'),

  close: () => ipcRenderer.send('overlay:close'),
  quit: () => ipcRenderer.send('overlay:quit'),
  reportOpenTime: (milliseconds) => ipcRenderer.send('overlay:opened', milliseconds),
  clearFailure: () => ipcRenderer.send('failure:clear'),
  openTokenPage: () => ipcRenderer.send('config:tokenPage'),
  openItem: (key) => ipcRenderer.send('item:open', key),

  transitions: (key) => ipcRenderer.invoke('item:transitions', key),
  item: (key) => ipcRenderer.invoke('item:detail', key),
  applyTransition: (request) => ipcRenderer.invoke('item:transition', request),
  updateItem: (request) => ipcRenderer.invoke('item:update', request),
  createItem: (draft) => ipcRenderer.invoke('item:create', draft),
  comment: (request) => ipcRenderer.invoke('item:comment', request),
  attach: (request) => ipcRenderer.invoke('item:attach', request),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  image: (url) => ipcRenderer.invoke('item:image', url),

  boards: () => ipcRenderer.invoke('meta:boards'),
  boardRequirements: (boardId) => ipcRenderer.invoke('meta:boardRequirements', boardId),
  issueTypes: (projectKey) => ipcRenderer.invoke('meta:issueTypes', projectKey),
  assignableUsers: (projectKey) => ipcRenderer.invoke('meta:assignableUsers', projectKey),
  createFields: (request) => ipcRenderer.invoke('meta:createFields', request),
  statuses: () => ipcRenderer.invoke('meta:statuses'),

  readConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (candidate) => ipcRenderer.invoke('config:save', candidate),

  readPreferences: () => ipcRenderer.invoke('prefs:get'),
  savePreferences: (patch) => ipcRenderer.invoke('prefs:save', patch)
});
