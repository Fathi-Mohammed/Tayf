'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toWorkItem,
  toWorkItemDetail,
  toTransition,
  documentToText,
  isRichDocument,
  textToDocument
} = require('../src/providers/jira/mappers');

const paragraph = (text) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }]
});

const RAW_ISSUE = {
  key: 'FPE-12',
  fields: {
    summary: 'Fix the login screen',
    project: { key: 'FPE' },
    status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    issuetype: { id: '10004', name: 'Bug', subtask: false },
    priority: { name: 'High' },
    assignee: { displayName: 'Fathy', accountId: 'acc-1' },
    duedate: '2026-09-05',
    timetracking: { originalEstimate: '4h', timeSpent: '1h', timeSpentSeconds: 3600 },
    aggregatetimespent: 7200,
    updated: '2026-09-01T10:00:00.000+0000',
    labels: ['React'],
    customfield_101: { id: 'v1', value: 'UI Task' },
    customfield_202: '2026-09-01',
    description: {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'first line' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'second line' }] }
      ]
    },
    comment: {
      comments: [
        {
          id: '1',
          author: { displayName: 'Fathy' },
          created: '2026-09-01T12:00:00.000+0000',
          body: paragraph('on it')
        },
        {
          id: '2',
          author: { displayName: 'Sara' },
          created: '2026-09-02T09:00:00.000+0000',
          body: paragraph('looks good')
        }
      ]
    }
  }
};

test('toWorkItem maps Jira shapes onto neutral names', () => {
  const item = toWorkItem(RAW_ISSUE);
  assert.equal(item.key, 'FPE-12');
  assert.equal(item.projectKey, 'FPE');
  assert.equal(item.title, 'Fix the login screen');
  assert.equal(item.status, 'In Progress');
  assert.equal(item.category, 'indeterminate');
  assert.equal(item.type, 'Bug');
  assert.equal(item.assigneeId, 'acc-1');
  assert.equal(item.due, '2026-09-05');
  assert.equal(item.estimate, '4h');
});

test('toWorkItem prefers aggregate time so parent items are not shown as untouched', () => {
  assert.equal(toWorkItem(RAW_ISSUE).spentSeconds, 7200);
});

test('toWorkItem falls back to the issue timetracking seconds', () => {
  const withoutAggregate = { key: 'X-1', fields: { timetracking: { timeSpentSeconds: 60 } } };
  assert.equal(toWorkItem(withoutAggregate).spentSeconds, 60);
});

test('toWorkItem survives an issue with almost no fields', () => {
  const item = toWorkItem({ key: 'X-1', fields: {} });
  assert.equal(item.title, '');
  assert.equal(item.status, null);
  assert.equal(item.category, 'new');
  assert.equal(item.spentSeconds, 0);
});

test('toWorkItemDetail separates custom option fields from custom date fields', () => {
  const detail = toWorkItemDetail(RAW_ISSUE);
  assert.deepEqual(detail.optionValues, { customfield_101: { id: 'v1', value: 'UI Task' } });
  assert.deepEqual(detail.dateValues, { customfield_202: '2026-09-01' });
  assert.deepEqual(detail.labels, ['React']);
  assert.equal(detail.typeId, '10004');
});

test('toWorkItemDetail flattens the description document to plain text', () => {
  assert.equal(toWorkItemDetail(RAW_ISSUE).description, 'first line\n\nsecond line');
});

test('toWorkItemDetail flattens comments to author, time and plain text', () => {
  const detail = toWorkItemDetail(RAW_ISSUE);
  assert.equal(detail.comments.length, 2);
  const comment = detail.comments[1];
  assert.equal(comment.id, '2');
  assert.equal(comment.author, 'Sara');
  assert.equal(comment.at, '2026-09-02T09:00:00.000+0000');
  assert.equal(comment.text, 'looks good');
  assert.deepEqual(comment.doc.blocks, [{ kind: 'paragraph', spans: [{ text: 'looks good' }] }]);
});

test('toWorkItemDetail keeps the newest comments and drops the rest', () => {
  const comments = Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    author: { displayName: 'Fathy' },
    created: '2026-09-02T09:00:00.000+0000',
    body: paragraph(`comment ${index}`)
  }));

  const fields = { comment: { comments, total: comments.length } };
  const detail = toWorkItemDetail({ key: 'X-1', fields });
  assert.equal(detail.comments.length, 5);
  assert.equal(detail.comments[0].text, 'comment 2');
  assert.equal(detail.comments[4].text, 'comment 6');
  assert.equal(detail.commentTotal, 7);
});

test('toWorkItemDetail reports no comments when the issue has none', () => {
  assert.deepEqual(toWorkItemDetail({ key: 'X-1', fields: {} }).comments, []);
});

test('toTransition exposes the resolutions Jira offers, and nothing invented', () => {
  const transition = toTransition({
    id: '31',
    name: 'Close',
    to: { name: 'Done', statusCategory: { key: 'done' } },
    fields: {
      resolution: {
        required: true,
        allowedValues: [{ id: '1', name: ' Done ' }, { id: '2', name: "Won't Do" }]
      }
    }
  });

  assert.equal(transition.toStatus, 'Done');
  assert.equal(transition.toCategory, 'done');
  assert.equal(transition.requiresFields, true);
  assert.deepEqual(transition.resolutions, [
    { id: '1', name: 'Done' },
    { id: '2', name: "Won't Do" }
  ]);
});

test('toTransition reports no resolutions when the transition offers none', () => {
  const transition = toTransition({ id: '11', name: 'Start', to: { name: 'In Progress' }, fields: {} });
  assert.equal(transition.resolutions, null);
  assert.equal(transition.requiresFields, false);
});

test('documentToText keeps hard breaks inside a paragraph', () => {
  const document = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }]
      }
    ]
  };
  assert.equal(documentToText(document).trim(), 'a\nb');
});

test('textToDocument returns null for blank text', () => {
  assert.equal(textToDocument(''), null);
  assert.equal(textToDocument('   \n  '), null);
});

test('textToDocument keeps line breaks inside a paragraph', () => {
  const text = 'first line\nsame paragraph';
  assert.equal(documentToText(textToDocument(text)).trim(), text);
});

test('documentToText keeps the blank line between paragraphs', () => {
  const text = 'first paragraph\n\nsecond paragraph';
  assert.equal(documentToText(textToDocument(text)).trim(), text);
});

test('documentToText keeps headings and list items readable', () => {
  const document = {
    type: 'doc',
    content: [
      { type: 'heading', content: [{ type: 'text', text: 'Steps' }] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph('one')] },
          { type: 'listItem', content: [paragraph('two')] }
        ]
      },
      paragraph('after')
    ]
  };
  assert.equal(documentToText(document).trim(), 'Steps\n\n• one\n• two\n\nafter');
});

test('documentToText spells out a mention instead of dropping it', () => {
  const document = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'thanks ' },
          { type: 'mention', attrs: { id: 'acc-9', text: '@Sara Ali' } }
        ]
      }
    ]
  };
  assert.equal(documentToText(document).trim(), 'thanks \u2068@Sara Ali\u2069');
});

test('documentToText keeps the link behind the words, and marks an image', () => {
  const document = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'the spec',
            marks: [{ type: 'link', attrs: { href: 'https://x.test/s' } }]
          }
        ]
      },
      { type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'm1', type: 'file' } }] }
    ]
  };
  assert.equal(documentToText(document).trim(), 'the spec (https://x.test/s)\n\n[image]');
});

test('documentToText shows which task list items are ticked', () => {
  const document = {
    type: 'doc',
    content: [
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { state: 'DONE' },
            content: [{ type: 'text', text: 'shipped' }]
          },
          {
            type: 'taskItem',
            attrs: { state: 'TODO' },
            content: [{ type: 'text', text: 'pending' }]
          }
        ]
      }
    ]
  };
  assert.equal(documentToText(document).trim(), '[x] shipped\n[ ] pending');
});

test('isRichDocument tells a plain document from one we cannot rebuild', () => {
  assert.equal(isRichDocument(textToDocument('one\ntwo\n\nthree')), false);
  assert.equal(isRichDocument(null), false);
  assert.equal(
    isRichDocument({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'strong' }] }] }
      ]
    }),
    true
  );
  assert.equal(isRichDocument({ type: 'doc', content: [{ type: 'bulletList', content: [] }] }), true);
});

test('textToDocument turns picked names into real mentions, longest first', () => {
  const document = textToDocument('thanks @Sara Ali and @Sara', [
    { text: '@Sara', accountId: 'acc-3' },
    { text: '@Sara Ali', accountId: 'acc-9' }
  ]);

  assert.deepEqual(document.content[0].content, [
    { type: 'text', text: 'thanks ' },
    { type: 'mention', attrs: { id: 'acc-9', text: '@Sara Ali' } },
    { type: 'text', text: ' and ' },
    { type: 'mention', attrs: { id: 'acc-3', text: '@Sara' } }
  ]);
});

test('textToDocument ignores a mention that is missing an account', () => {
  const document = textToDocument('hi @Ghost', [{ text: '@Ghost' }]);
  assert.deepEqual(document.content[0].content, [{ type: 'text', text: 'hi @Ghost' }]);
});
