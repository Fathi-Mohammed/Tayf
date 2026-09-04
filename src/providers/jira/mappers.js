'use strict';

const BLOCK_SEPARATORS = {
  paragraph: '\n\n',
  heading: '\n\n',
  blockquote: '\n\n',
  codeBlock: '\n\n',
  bulletList: '\n\n',
  orderedList: '\n\n',
  listItem: '\n'
};
const CUSTOM_FIELD = /^customfield_/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toWorkItem(issue) {
  const fields = issue.fields || {};
  const status = fields.status || {};
  const issueType = fields.issuetype || {};
  const tracking = fields.timetracking || {};

  return {
    key: issue.key,
    projectKey: (fields.project && fields.project.key) || null,
    projectName: (fields.project && fields.project.name) || null,
    title: fields.summary || '',
    status: status.name || null,
    category: (status.statusCategory && status.statusCategory.key) || 'new',
    type: issueType.name || null,
    isSubtask: !!issueType.subtask,
    priority: (fields.priority && fields.priority.name) || null,
    assignee: (fields.assignee && fields.assignee.displayName) || null,
    assigneeId: (fields.assignee && fields.assignee.accountId) || null,
    due: fields.duedate || null,
    estimate: tracking.originalEstimate || null,
    spent: tracking.timeSpent || null,
    spentSeconds: fields.aggregatetimespent || tracking.timeSpentSeconds || 0,
    updated: fields.updated || null,
    categoryChangedAt: fields.statuscategorychangedate || null
  };
}

function documentToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';

  const text = (node.content || []).map(documentToText).join('');
  const separator = BLOCK_SEPARATORS[node.type];
  if (!separator) return text;
  return text.replace(/\n+$/, '') + separator;
}

function textToDocument(text) {
  const normalised = String(text == null ? '' : text).replace(/\r/g, '');
  if (!normalised.trim()) return null;

  const content = normalised
    .split(/\n{2,}/)
    .map((paragraph) => {
      const nodes = [];
      paragraph.split('\n').forEach((line, index) => {
        if (index) nodes.push({ type: 'hardBreak' });
        if (line) nodes.push({ type: 'text', text: line });
      });
      return nodes;
    })
    .filter((nodes) => nodes.length)
    .map((nodes) => ({ type: 'paragraph', content: nodes }));

  if (!content.length) return null;
  return { type: 'doc', version: 1, content };
}

function customOptionValues(fields) {
  const values = {};
  Object.keys(fields).forEach((name) => {
    const value = fields[name];
    if (CUSTOM_FIELD.test(name) && value && value.id && value.value) {
      values[name] = { id: value.id, value: value.value };
    }
  });
  return values;
}

function customDateValues(fields) {
  const values = {};
  Object.keys(fields).forEach((name) => {
    const value = fields[name];
    if (CUSTOM_FIELD.test(name) && typeof value === 'string' && ISO_DATE.test(value)) {
      values[name] = value;
    }
  });
  return values;
}

function toWorkItemDetail(issue) {
  const fields = issue.fields || {};
  return {
    ...toWorkItem(issue),
    description: documentToText(fields.description).trim(),
    labels: fields.labels || [],
    typeId: (fields.issuetype && fields.issuetype.id) || null,
    optionValues: customOptionValues(fields),
    dateValues: customDateValues(fields)
  };
}

function toTransition(transition) {
  const fields = transition.fields || {};
  const resolution = fields.resolution;

  return {
    id: transition.id,
    name: transition.name,
    toStatus: (transition.to && transition.to.name) || transition.name,
    toCategory:
      (transition.to && transition.to.statusCategory && transition.to.statusCategory.key) || 'new',
    resolutions:
      resolution && Array.isArray(resolution.allowedValues)
        ? resolution.allowedValues.map((value) => ({
            id: value.id,
            name: String(value.name || '').trim()
          }))
        : null,
    requiresFields: Object.values(fields).some((field) => field && field.required)
  };
}

module.exports = {
  toWorkItem,
  toWorkItemDetail,
  toTransition,
  documentToText,
  textToDocument
};
