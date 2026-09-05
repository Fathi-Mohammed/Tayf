'use strict';

const { ipcMain, shell } = require('electron');
const credentials = require('../storage/credentials');
const { errorText, NOTIFICATION_TEXT, ERROR_TEXT } = require('../strings');

function notConfigured() {
  return { error: ERROR_TEXT['not-configured'] };
}

function serialiseState(state, workingStatuses) {
  return {
    ...state,
    workingStatuses: workingStatuses || null,
    error: state.error ? errorText(state.error) : null
  };
}

function register({ workspace, overlay, settings, actions }) {
  const provider = () => workspace.provider;

  async function fromProvider(call, shape) {
    if (!provider()) return notConfigured();
    try {
      return shape(await call(provider()));
    } catch (error) {
      return { error: errorText(error) };
    }
  }

  ipcMain.on('overlay:close', () => overlay.hide());
  ipcMain.on('overlay:quit', actions.quit);
  ipcMain.on('overlay:opened', (_event, milliseconds) => actions.reportOpenTime(milliseconds));
  ipcMain.on('failure:clear', () => workspace.clearFailure());
  ipcMain.on('config:tokenPage', () =>
    shell.openExternal('https://id.atlassian.com/manage-profile/security/api-tokens')
  );
  ipcMain.on('item:open', (_event, key) => {
    if (provider()) shell.openExternal(provider().itemUrl(key));
  });

  ipcMain.handle('workspace:state', () =>
    serialiseState(workspace.state, settings.get('nudgeWorkingStatuses'))
  );

  ipcMain.handle('item:transitions', (_event, key) =>
    fromProvider(
      (jira) => jira.transitions(key),
      (transitions) => ({ transitions })
    )
  );

  ipcMain.handle('item:detail', (_event, key) =>
    fromProvider(
      (jira) => jira.item(key),
      (item) => ({ item })
    )
  );

  ipcMain.handle('item:transition', async (_event, request) => {
    if (!provider()) return notConfigured();

    const result = await workspace.applyTransition(request);
    if (result.ok) return result;

    const reason = result.needsWorklog
      ? ERROR_TEXT['worklog-required']
      : errorText(result.error);
    const message = NOTIFICATION_TEXT.transitionFailed(result.toStatus, reason);
    workspace.recordFailure(request.key, message);
    return { error: message };
  });

  ipcMain.handle('item:update', async (_event, { key, fields }) => {
    if (!provider()) return notConfigured();
    try {
      await workspace.updateItem(key, fields);
      return { ok: true };
    } catch (error) {
      const message = NOTIFICATION_TEXT.updateFailed(errorText(error));
      workspace.recordFailure(key, message);
      return { error: message };
    }
  });

  ipcMain.handle('item:comment', async (_event, { key, doc }) => {
    if (!provider()) return notConfigured();
    try {
      return { comment: await workspace.commentOnItem(key, doc) };
    } catch (error) {
      const message = NOTIFICATION_TEXT.commentFailed(errorText(error));
      workspace.recordFailure(key, message);
      return { error: message };
    }
  });

  ipcMain.handle('item:attach', async (_event, { key, file }) => {
    if (!provider()) return notConfigured();
    try {
      return { file: await workspace.attachFile(key, file) };
    } catch (error) {
      const message = NOTIFICATION_TEXT.attachFailed(errorText(error));
      workspace.recordFailure(key, message);
      return { error: message };
    }
  });

  ipcMain.handle('item:image', async (_event, url) => {
    if (!provider()) return notConfigured();
    try {
      return { data: await workspace.readImage(url) };
    } catch {
      return { data: null };
    }
  });

  ipcMain.handle('item:create', async (_event, draft) => {
    if (!provider()) return notConfigured();
    try {
      const requirements = draft.boardId
        ? await provider().boardRequirements(draft.boardId)
        : { fields: {} };

      const key = await workspace.createItem({
        ...draft,
        optionFields: { ...requirements.fields, ...(draft.optionFields || {}) }
      });

      settings.remember({
        lastBoardId: draft.boardId,
        lastProjectKey: draft.projectKey,
        lastIssueTypeId: draft.typeId,
        lastOptionFieldsByProject: {
          ...settings.get('lastOptionFieldsByProject'),
          [draft.projectKey]: draft.optionFields || {}
        }
      });

      return { key };
    } catch (error) {
      const message = NOTIFICATION_TEXT.createFailed(errorText(error));
      workspace.recordFailure(null, message);
      return { error: message };
    }
  });

  ipcMain.handle('meta:boards', () =>
    fromProvider(
      (jira) => jira.boards(),
      (boards) => ({ boards, lastBoardId: settings.get('lastBoardId') })
    )
  );

  ipcMain.handle('meta:boardRequirements', (_event, boardId) =>
    fromProvider(
      (jira) => jira.boardRequirements(boardId),
      (requirements) => requirements
    )
  );

  ipcMain.handle('meta:issueTypes', (_event, projectKey) =>
    fromProvider(
      (jira) => jira.issueTypes(projectKey),
      (types) => ({ types, lastIssueTypeId: settings.get('lastIssueTypeId') })
    )
  );

  ipcMain.handle('meta:assignableUsers', (_event, projectKey) =>
    fromProvider(
      (jira) => jira.assignableUsers(projectKey),
      (users) => ({ users, currentUserId: workspace.state.user && workspace.state.user.accountId })
    )
  );

  ipcMain.handle('meta:statuses', () =>
    fromProvider(
      async (jira) => {
        const onBoard = (workspace.state.items || [])
          .map((item) => item.projectKey)
          .filter(Boolean);
        const fallback = [settings.get('lastProjectKey')].filter(Boolean);
        const keys = [...new Set(onBoard.length ? onBoard : fallback)];
        const lists = await Promise.all(keys.map((key) => jira.statuses(key)));

        const byName = new Map();
        lists.flat().forEach((status) => byName.set(status.name, status));
        return [...byName.values()];
      },
      (statuses) => ({ statuses, working: settings.get('nudgeWorkingStatuses') })
    )
  );

  ipcMain.handle('meta:createFields', async (_event, { projectKey, typeId }) => {
    if (!provider()) return notConfigured();
    const fields = await provider().createFields(projectKey, typeId);
    const remembered = settings.get('lastOptionFieldsByProject') || {};
    return { ...fields, lastOptionFields: remembered[projectKey] || {} };
  });

  ipcMain.handle('prefs:get', () => actions.readPreferences());
  ipcMain.handle('prefs:save', (_event, patch) => actions.savePreferences(patch));

  ipcMain.handle('config:get', () => credentials.readWithoutToken());

  ipcMain.handle('config:save', async (_event, candidate) => {
    const existing = credentials.read();
    const token = String(candidate.token || '').trim() || (existing && existing.token) || '';

    if (!String(candidate.site || '').trim()) return { error: ERROR_TEXT['site-required'] };
    if (!String(candidate.email || '').trim()) return { error: ERROR_TEXT['email-required'] };
    if (!token) return { error: ERROR_TEXT['token-required'] };

    try {
      credentials.write({ ...candidate, token });
    } catch {
      return { error: ERROR_TEXT['save-failed'] };
    }

    try {
      const user = await actions.reconnect();
      return { ok: true, name: user && user.name };
    } catch (error) {
      return { error: errorText(error) };
    }
  });
}

module.exports = { register, serialiseState };
