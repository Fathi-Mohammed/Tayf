'use strict';

const { JiraClient, JiraError } = require('./client');
const issues = require('./issues');
const boards = require('./boards');
const metadata = require('./metadata');

class JiraProvider {
  constructor(credentials) {
    this.credentials = credentials;
    this.client = new JiraClient(credentials);
    this.boardsPromise = null;
    this.projectsPromise = null;
    this.requirementsByBoardId = new Map();
  }

  get id() {
    return 'jira-cloud';
  }

  itemUrl(key) {
    return `https://${this.credentials.site}/browse/${encodeURIComponent(key)}`;
  }

  currentUser() {
    return metadata.fetchCurrentUser(this.client);
  }

  assignedItems() {
    return issues.fetchAssignedItems(this.client);
  }

  item(key) {
    return issues.fetchItem(this.client, key);
  }

  updateItem(key, fields) {
    return issues.updateItem(this.client, key, fields);
  }

  addComment(key, text) {
    return issues.addComment(this.client, key, text);
  }

  transitions(key) {
    return issues.fetchTransitions(this.client, key);
  }

  applyTransition(key, transitionId, extras) {
    return issues.applyTransition(this.client, key, transitionId, extras);
  }

  createItem(draft) {
    return issues.createItem(this.client, draft);
  }

  boards() {
    if (!this.boardsPromise) {
      this.boardsPromise = boards.fetchBoards(this.client).catch((error) => {
        this.boardsPromise = null;
        throw error;
      });
    }
    return this.boardsPromise;
  }

  async boardRequirements(boardId) {
    if (this.requirementsByBoardId.has(boardId)) {
      return this.requirementsByBoardId.get(boardId);
    }
    const known = await this.boards();
    const board = known.find((candidate) => candidate.id === boardId);
    const requirements = await boards.fetchBoardRequirements(
      this.client,
      boardId,
      board && board.projectKey
    );
    this.requirementsByBoardId.set(boardId, requirements);
    return requirements;
  }

  async boardsByItemKey(projectKeys) {
    return boards.mapItemsToBoards(this.client, await this.boards(), projectKeys);
  }

  projects() {
    if (!this.projectsPromise) {
      this.projectsPromise = metadata.fetchProjects(this.client).catch((error) => {
        this.projectsPromise = null;
        throw error;
      });
    }
    return this.projectsPromise;
  }

  issueTypes(projectKey) {
    return metadata.fetchIssueTypes(this.client, projectKey);
  }

  assignableUsers(projectKey) {
    return metadata.fetchAssignableUsers(this.client, projectKey);
  }

  statuses(projectKey) {
    return metadata.fetchStatuses(this.client, projectKey);
  }

  createFields(projectKey, typeId) {
    return metadata.fetchCreateFields(this.client, projectKey, typeId);
  }
}

module.exports = { JiraProvider, JiraError };
