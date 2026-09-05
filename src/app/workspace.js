'use strict';

const { EventEmitter } = require('events');

const BOARD_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const WORKLOG_REJECTION = /time\s*spent/i;

function rejectedForMissingWorklog(error) {
  return WORKLOG_REJECTION.test(`${error.detail || ''} ${error.message || ''}`);
}

function worklogTag(itemKey, transitionId) {
  return `${String(itemKey).split('-')[0]}:${transitionId}`;
}

class Workspace extends EventEmitter {
  constructor({ cache, log }) {
    super();
    this.cache = cache;
    this.log = log;
    this.provider = null;
    this.refreshing = false;
    this.boardSync = { signature: '', at: 0, running: false };

    const stored = cache.read();
    this.state = {
      configured: false,
      error: null,
      failure: null,
      items: stored.items,
      fetchedAt: stored.fetchedAt,
      user: null,
      boardsByItemKey: stored.boardsByItemKey,
      transitionsNeedingWorklog: stored.transitionsNeedingWorklog
    };
    this.attachBoards();
  }

  useProvider(provider) {
    this.provider = provider;
    this.state.configured = !!provider;
    this.state.user = null;
    this.boardSync = { signature: '', at: 0, running: false };
    this.state.boardsByItemKey = {};
  }

  publish() {
    this.emit('change', this.state);
  }

  persist() {
    this.cache.write({
      items: this.state.items,
      fetchedAt: this.state.fetchedAt,
      boardsByItemKey: this.state.boardsByItemKey,
      transitionsNeedingWorklog: this.state.transitionsNeedingWorklog
    });
  }

  attachBoards() {
    const byKey = this.state.boardsByItemKey || {};
    this.state.items.forEach((item) => {
      item.boards = byKey[item.key] || null;
    });
  }

  recordFailure(itemKey, message) {
    this.state.failure = { key: itemKey, message, at: Date.now() };
    this.log.appendLine(`${itemKey ? `${itemKey}  ` : ''}${message}`);
    this.emit('failure', this.state.failure);
    this.publish();
  }

  clearFailure() {
    this.state.failure = null;
    this.publish();
  }

  async refresh() {
    if (this.refreshing) return;
    if (!this.provider) {
      this.state.configured = false;
      this.state.error = null;
      this.publish();
      return;
    }

    this.refreshing = true;
    try {
      if (!this.state.user) {
        this.state.user = await this.provider.currentUser();
      }
      this.state.items = await this.provider.assignedItems();
      this.state.fetchedAt = Date.now();
      this.state.error = null;
      this.attachBoards();
      this.persist();
      this.syncBoards();
    } catch (error) {
      this.state.error = error;
    } finally {
      this.refreshing = false;
      this.publish();
    }
  }

  async syncBoards() {
    if (this.boardSync.running || !this.provider || !this.state.items.length) return;

    const signature = this.state.items
      .map((item) => item.key)
      .sort()
      .join(',');
    const fresh =
      signature === this.boardSync.signature &&
      Date.now() - this.boardSync.at < BOARD_SYNC_INTERVAL_MS;
    if (fresh) return;

    this.boardSync.running = true;
    try {
      const projectKeys = [
        ...new Set(
          this.state.items
            .map((item) => item.projectKey || String(item.key || '').split('-')[0])
            .filter(Boolean)
        )
      ];

      this.state.boardsByItemKey = await this.provider.boardsByItemKey(projectKeys);
      this.boardSync.signature = signature;
      this.boardSync.at = Date.now();
      this.attachBoards();
      this.persist();
      this.publish();
    } catch (error) {
      this.log.appendLine(`boards: ${error.message}`);
    } finally {
      this.boardSync.running = false;
    }
  }

  async applyTransition({ key, transitionId, toStatus, toCategory, ...extras }) {
    const item = this.state.items.find((candidate) => candidate.key === key);
    const previous = item ? { status: item.status, category: item.category } : null;

    if (item) {
      item.status = toStatus;
      item.category = toCategory;
    }
    this.persist();
    this.publish();

    try {
      await this.provider.applyTransition(key, transitionId, extras);
      this.refresh();
      return { ok: true };
    } catch (error) {
      if (item && previous) Object.assign(item, previous);
      if (rejectedForMissingWorklog(error)) {
        const tag = worklogTag(key, transitionId);
        if (!this.state.transitionsNeedingWorklog.includes(tag)) {
          this.state.transitionsNeedingWorklog.push(tag);
        }
        this.persist();
        return { error, needsWorklog: true, toStatus };
      }
      this.persist();
      return { error, toStatus };
    }
  }

  async updateItem(key, fields) {
    await this.provider.updateItem(key, fields);
    this.refresh();
  }

  async commentOnItem(key, doc) {
    const comment = await this.provider.addComment(key, doc);
    this.refresh();
    return comment;
  }

  attachFile(key, file) {
    return this.provider.attachFile(key, file);
  }

  readImage(url) {
    return this.provider.readImage(url);
  }

  async createItem(draft) {
    const key = await this.provider.createItem(draft);
    this.refresh();
    return key;
  }
}

module.exports = { Workspace, worklogTag };
