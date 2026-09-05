'use strict';

const { settingsFile } = require('./paths');
const { readJson, writeJsonQuietly } = require('./json-file');

const DEFAULTS = {
  hotkey: null,
  addHotkey: null,
  nudgesEnabled: true,
  nudgeEveryMinutes: 15,
  nudgeIdleMinutes: 10,
  nudgeWorkStart: '08:00',
  nudgeWorkEnd: '18:00',
  nudgeWorkDays: [0, 1, 2, 3, 4],
  nudgeWorkingStatuses: null,
  nudgeOverdueEnabled: true,
  nudgeOverdueDays: 1,
  nudgeCheckEnabled: true,
  nudgeCheckMinutes: 90,
  nudgeSnoozeUntil: null,
  appearance: 'system',
  language: 'ar',
  theme: 'tokyo',
  font: 'default',
  uiScale: 1,
  boardView: 'compact',
  boardFilterId: null,
  lastBoardId: null,
  lastProjectKey: null,
  lastIssueTypeId: null,
  lastOptionFieldsByProject: {}
};

const NUDGE_KEYS = {
  enabled: 'nudgesEnabled',
  everyMinutes: 'nudgeEveryMinutes',
  idleMinutes: 'nudgeIdleMinutes',
  workStart: 'nudgeWorkStart',
  workEnd: 'nudgeWorkEnd',
  workDays: 'nudgeWorkDays',
  workingStatuses: 'nudgeWorkingStatuses',
  overdueEnabled: 'nudgeOverdueEnabled',
  overdueDays: 'nudgeOverdueDays',
  checkEnabled: 'nudgeCheckEnabled',
  checkMinutes: 'nudgeCheckMinutes'
};

function createSettings() {
  const values = { ...DEFAULTS, ...readJson(settingsFile(), {}) };

  return {
    get: (name) => values[name],
    set(name, value) {
      values[name] = value;
      writeJsonQuietly(settingsFile(), values);
    },
    remember(patch) {
      Object.assign(values, patch);
      writeJsonQuietly(settingsFile(), values);
    }
  };
}

module.exports = { createSettings, DEFAULTS, NUDGE_KEYS };
