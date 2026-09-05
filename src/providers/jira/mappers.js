'use strict';

const BLOCK_SEPARATORS = {
  paragraph: '\n\n',
  heading: '\n\n',
  codeBlock: '\n\n',
  mediaSingle: '\n\n',
  mediaGroup: '\n\n',
  listItem: '\n'
};
const MEDIA_NODES = new Set(['media', 'mediaInline']);
const PLAIN_NODES = new Set(['doc', 'paragraph', 'text', 'hardBreak']);
const NESTED_INDENT = '\n  ';
const ISOLATE_START = '\u2068';
const ISOLATE_END = '\u2069';
const CUSTOM_FIELD = /^customfield_/;
const RECENT_COMMENTS = 5;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toWorkItem(issue) {
  const fields = issue.fields || {};
  const status = fields.status || {};
  const issueType = fields.issuetype || {};
  const tracking = fields.timetracking || {};

  return {
    key: issue.key,
    projectKey: (fields.project && fields.project.key) || null,
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

function linkedText(node) {
  const text = node.text || '';
  const link = (node.marks || []).find((mark) => mark.type === 'link');
  const href = (link && link.attrs && link.attrs.href) || '';
  if (!href || !text || text.includes(href) || href.includes(text)) return text;
  return `${text} (${href})`;
}

function mentionText(node) {
  const attrs = node.attrs || {};
  const name = String(attrs.text || attrs.displayName || '').trim() || 'user';
  const handle = name.startsWith('@') ? name : `@${name}`;
  return `${ISOLATE_START}${handle}${ISOLATE_END}`;
}

function mediaText(node) {
  const name = String((node.attrs && node.attrs.alt) || '').trim();
  return name ? `[${name}]` : '[image]';
}

function listText(items, marker) {
  const lines = (items || []).map(
    (item, index) => marker(item, index) + documentToText(item).trim().replace(/\n/g, NESTED_INDENT)
  );
  return `${lines.join('\n')}\n\n`;
}

function quoteText(node) {
  const inner = (node.content || []).map(documentToText).join('').trim();
  if (!inner) return '';
  const quoted = inner
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `${quoted}\n\n`;
}

function documentToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return linkedText(node);
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'mention') return mentionText(node);
  if (node.type === 'emoji') {
    return String((node.attrs && (node.attrs.text || node.attrs.shortName)) || '');
  }
  if (MEDIA_NODES.has(node.type)) return mediaText(node);
  if (node.type === 'blockquote') return quoteText(node);
  if (node.type === 'bulletList') return listText(node.content, () => '• ');
  if (node.type === 'orderedList') return listText(node.content, (item, index) => `${index + 1}. `);
  if (node.type === 'taskList') {
    return listText(node.content, (item) =>
      item && item.attrs && item.attrs.state === 'DONE' ? '[x] ' : '[ ] '
    );
  }

  const text = (node.content || []).map(documentToText).join('');
  const separator = BLOCK_SEPARATORS[node.type];
  if (!separator) return text;
  return text.replace(/\n+$/, '') + separator;
}

function isRichDocument(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type && !PLAIN_NODES.has(node.type)) return true;
  if ((node.marks || []).length) return true;
  return (node.content || []).some(isRichDocument);
}

function inlineNodes(line, mentions) {
  if (!line) return [];
  if (!mentions.length) return [{ type: 'text', text: line }];

  const nodes = [];
  let buffer = '';
  let index = 0;

  while (index < line.length) {
    const hit = mentions.find((mention) => line.startsWith(mention.text, index));
    if (!hit) {
      buffer += line[index];
      index += 1;
      continue;
    }
    if (buffer) {
      nodes.push({ type: 'text', text: buffer });
      buffer = '';
    }
    nodes.push({ type: 'mention', attrs: { id: hit.accountId, text: hit.text } });
    index += hit.text.length;
  }

  if (buffer) nodes.push({ type: 'text', text: buffer });
  return nodes;
}

function namedMentions(mentions) {
  return (mentions || [])
    .filter((mention) => mention && mention.accountId && mention.text)
    .sort((one, two) => two.text.length - one.text.length);
}

function textToDocument(text, mentions) {
  const normalised = String(text == null ? '' : text).replace(/\r/g, '');
  if (!normalised.trim()) return null;

  const named = namedMentions(mentions);
  const content = normalised
    .split(/\n{2,}/)
    .map((paragraph) => {
      const nodes = [];
      paragraph.split('\n').forEach((line, index) => {
        if (index) nodes.push({ type: 'hardBreak' });
        nodes.push(...inlineNodes(line, named));
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

function toComment(comment) {
  return {
    id: (comment && comment.id) || null,
    author: (comment && comment.author && comment.author.displayName) || '',
    at: (comment && comment.created) || null,
    text: documentToText(comment && comment.body).trim()
  };
}

function toComments(field) {
  const comments = ((field && field.comments) || []).slice(-RECENT_COMMENTS).map(toComment);
  return { comments, commentTotal: Number(field && field.total) || comments.length };
}

function toWorkItemDetail(issue) {
  const fields = issue.fields || {};
  return {
    ...toWorkItem(issue),
    description: documentToText(fields.description).trim(),
    descriptionIsRich: isRichDocument(fields.description),
    labels: fields.labels || [],
    typeId: (fields.issuetype && fields.issuetype.id) || null,
    optionValues: customOptionValues(fields),
    dateValues: customDateValues(fields),
    ...toComments(fields.comment)
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
  RECENT_COMMENTS,
  toWorkItem,
  toWorkItemDetail,
  toComment,
  toTransition,
  documentToText,
  isRichDocument,
  textToDocument
};
