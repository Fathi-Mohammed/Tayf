'use strict';

const {
  RECENT_COMMENTS,
  toWorkItem,
  toWorkItemDetail,
  toComment,
  toTransition,
  textToDocument
} = require('./mappers');

const ASSIGNED_AND_OPEN =
  'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';

const LIST_FIELDS = [
  'summary',
  'status',
  'priority',
  'issuetype',
  'updated',
  'statuscategorychangedate',
  'duedate',
  'assignee',
  'timetracking',
  'aggregatetimespent',
  'project'
].join(',');

const ENDPOINT_GONE = new Set([404, 410]);

async function fetchAssignedItems(client) {
  const query = new URLSearchParams({
    jql: ASSIGNED_AND_OPEN,
    fields: LIST_FIELDS,
    maxResults: '50'
  }).toString();

  try {
    const page = await client.get(`/rest/api/3/search/jql?${query}`);
    return (page.issues || []).map(toWorkItem);
  } catch (error) {
    if (!ENDPOINT_GONE.has(error.status)) throw error;
    const page = await client.get(`/rest/api/3/search?${query}`);
    return (page.issues || []).map(toWorkItem);
  }
}

async function fetchComments(client, key) {
  const page = await client.get(
    `/rest/api/3/issue/${encodeURIComponent(key)}/comment` +
      `?orderBy=-created&maxResults=${RECENT_COMMENTS}`
  );
  const comments = (page.comments || []).map(toComment).reverse();
  return { comments, commentTotal: Number(page.total) || comments.length };
}

async function fetchItem(client, key) {
  const [issue, recent] = await Promise.all([
    client.get(`/rest/api/3/issue/${encodeURIComponent(key)}`),
    fetchComments(client, key).catch(() => null)
  ]);
  return { ...toWorkItemDetail(issue), ...(recent || {}) };
}

async function updateItem(client, key, fields) {
  const payload = { ...fields };
  if (typeof payload.description === 'string') {
    payload.description = textToDocument(payload.description);
  }
  await client.put(`/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: payload });
}

async function addComment(client, key, text) {
  const body = textToDocument(text);
  const created = await client.post(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
    body
  });
  return toComment(created);
}

async function fetchTransitions(client, key) {
  const response = await client.get(
    `/rest/api/3/issue/${encodeURIComponent(key)}/transitions?expand=transitions.fields`
  );
  return (response.transitions || []).map(toTransition);
}

async function logWork(client, key, timeSpent) {
  await client.post(
    `/rest/api/3/issue/${encodeURIComponent(key)}/worklog?notifyUsers=false&adjustEstimate=auto`,
    { timeSpent }
  );
}

async function applyTransition(client, key, transitionId, extras = {}) {
  const { fieldsBefore, timeSpent, transitionFields } = extras;

  if (fieldsBefore && Object.keys(fieldsBefore).length) {
    await updateItem(client, key, fieldsBefore);
  }
  if (timeSpent) {
    await logWork(client, key, timeSpent);
  }

  const payload = { transition: { id: transitionId } };
  if (transitionFields && Object.keys(transitionFields).length) {
    payload.fields = transitionFields;
  }
  await client.post(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, payload);
}

async function createItem(client, draft) {
  const fields = {
    project: { key: draft.projectKey },
    summary: draft.summary,
    issuetype: { id: draft.typeId }
  };

  if (draft.assigneeId) fields.assignee = { accountId: draft.assigneeId };

  const description = textToDocument(draft.description);
  if (description) fields.description = description;
  if (draft.due) fields.duedate = draft.due;
  if (draft.estimate) fields.timetracking = { originalEstimate: draft.estimate };

  const dateFields = draft.dateFields || {};
  Object.keys(dateFields).forEach((fieldId) => {
    if (dateFields[fieldId]) fields[fieldId] = dateFields[fieldId];
  });
  Object.assign(fields, draft.optionFields || {});

  const created = await client.post('/rest/api/3/issue', { fields });
  return created && created.key;
}

module.exports = {
  ASSIGNED_AND_OPEN,
  fetchAssignedItems,
  fetchItem,
  updateItem,
  addComment,
  fetchTransitions,
  applyTransition,
  logWork,
  createItem
};
