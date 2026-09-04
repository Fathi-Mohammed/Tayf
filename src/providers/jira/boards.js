'use strict';

const { inclusiveClauses } = require('./jql');
const { fetchFieldsByClauseName } = require('./metadata');

const MINE_AND_OPEN = 'assignee = currentUser() AND statusCategory != Done';
const MAX_BOARDS_PER_SYNC = 40;
const MAX_BOARD_PAGES = 6;
const PARALLEL_BOARD_REQUESTS = 3;

async function fetchBoards(client) {
  const boards = [];
  let startAt = 0;

  for (let page = 0; page < MAX_BOARD_PAGES; page += 1) {
    const response = await client.get(
      `/rest/agile/1.0/board?maxResults=50&startAt=${startAt}`
    );
    const values = response.values || [];

    values.forEach((board) => {
      const location = board.location || {};
      boards.push({
        id: board.id,
        name: board.name,
        type: board.type,
        projectKey: location.projectKey || null,
        projectName: location.projectName || null
      });
    });

    if (response.isLast || !values.length) break;
    startAt += values.length;
  }

  return boards;
}

function fieldValueToPayload(field, value) {
  const { id, schema = {} } = field;

  if (id === 'labels') return { labels: [value] };
  if (id === 'components') return { components: [{ name: value }] };
  if (id === 'fixVersions') return { fixVersions: [{ name: value }] };
  if (schema.type === 'option') return { [id]: { value } };
  if (schema.type === 'array' && schema.items === 'string') return { [id]: [value] };
  if (schema.type === 'array') return { [id]: [{ value }] };
  return { [id]: value };
}

async function fetchBoardFilterJql(client, boardId) {
  const configuration = await client.get(`/rest/agile/1.0/board/${boardId}/configuration`);
  const filterId = configuration.filter && configuration.filter.id;
  const location = configuration.location || {};
  const projectKey = location.projectKey || location.key || null;

  if (!filterId) return { projectKey, jql: null };

  const filter = await client.get(`/rest/api/3/filter/${filterId}`);
  return { projectKey, jql: filter.jql || null };
}

async function fetchBoardRequirements(client, boardId, fallbackProjectKey) {
  const requirements = {
    projectKey: fallbackProjectKey || null,
    fields: {},
    applied: [],
    unreadableClauses: [],
    jql: null
  };

  let filter;
  try {
    filter = await fetchBoardFilterJql(client, boardId);
  } catch {
    return requirements;
  }

  requirements.projectKey = filter.projectKey || fallbackProjectKey || null;
  requirements.jql = filter.jql;
  if (!filter.jql) return requirements;

  const fieldsByName = await fetchFieldsByClauseName(client);

  inclusiveClauses(filter.jql).forEach(({ clause, parsed }) => {
    const field = fieldsByName[parsed.field.toLowerCase()];
    if (!field) {
      requirements.unreadableClauses.push(clause);
      return;
    }
    Object.assign(requirements.fields, fieldValueToPayload(field, parsed.value));
    requirements.applied.push({ label: field.name, value: parsed.value });
  });

  return requirements;
}

async function fetchMyItemKeysOnBoard(client, board) {
  const query = `maxResults=100&fields=key&jql=${encodeURIComponent(MINE_AND_OPEN)}`;
  const paths = [`/rest/agile/1.0/board/${board.id}/issue?${query}`];
  if (board.type === 'scrum') {
    paths.push(`/rest/agile/1.0/board/${board.id}/backlog?${query}`);
  }

  const keys = new Set();
  for (const path of paths) {
    try {
      const response = await client.get(path);
      (response.issues || []).forEach((issue) => keys.add(issue.key));
    } catch {
      continue;
    }
  }
  return [...keys];
}

async function mapItemsToBoards(client, allBoards, projectKeys) {
  const relevant = (allBoards || [])
    .filter((board) => !board.projectKey || projectKeys.includes(board.projectKey))
    .slice(0, MAX_BOARDS_PER_SYNC);

  const keysPerBoard = new Array(relevant.length);
  let nextIndex = 0;

  async function worker() {
    for (let index = nextIndex++; index < relevant.length; index = nextIndex++) {
      keysPerBoard[index] = await fetchMyItemKeysOnBoard(client, relevant[index]);
    }
  }

  await Promise.all(
    Array.from({ length: PARALLEL_BOARD_REQUESTS }, () => worker())
  );

  const boardsByItemKey = {};
  relevant.forEach((board, index) => {
    (keysPerBoard[index] || []).forEach((key) => {
      boardsByItemKey[key] = boardsByItemKey[key] || [];
      boardsByItemKey[key].push({
        id: board.id,
        name: board.name,
        projectKey: board.projectKey,
        projectName: board.projectName
      });
    });
  });

  return boardsByItemKey;
}

module.exports = {
  fetchBoards,
  fetchBoardRequirements,
  mapItemsToBoards,
  fieldValueToPayload,
  MINE_AND_OPEN
};
