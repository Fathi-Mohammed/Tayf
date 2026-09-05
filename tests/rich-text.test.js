'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  documentFromRich,
  richFromDocument,
  richTextOf,
  isSupported
} = require('../src/providers/jira/rich-text');

const RICH = {
  blocks: [
    { kind: 'heading', level: 2, spans: [{ text: 'Steps' }] },
    {
      kind: 'paragraph',
      spans: [
        { text: 'ask ' },
        { mention: { id: 'acc-9', label: '@Sara Ali' } },
        { text: ' to ' },
        { text: 'review', bold: true },
        { text: ' it', underline: true },
        { text: ' now', strike: true },
        { br: true },
        { text: 'the spec', link: 'https://x.test/s' }
      ]
    },
    {
      kind: 'list',
      variant: 'bullet',
      items: [{ spans: [{ text: 'renew on staging' }] }, { spans: [{ text: 'then production' }] }]
    },
    { kind: 'list', variant: 'ordered', items: [{ spans: [{ text: 'first' }] }] },
    {
      kind: 'list',
      variant: 'task',
      items: [
        { spans: [{ text: 'shipped' }], done: true },
        { spans: [{ text: 'pending' }], done: false }
      ]
    },
    { kind: 'quote', spans: [{ text: 'as agreed' }] },
    { kind: 'code', text: 'npm run dist' }
  ]
};

test('documentFromRich builds the Jira document our editor means', () => {
  const document = documentFromRich(RICH);

  assert.equal(document.type, 'doc');
  assert.deepEqual(document.content[0], {
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: 'Steps' }]
  });
  assert.deepEqual(document.content[1].content, [
    { type: 'text', text: 'ask ' },
    { type: 'mention', attrs: { id: 'acc-9', text: '@Sara Ali' } },
    { type: 'text', text: ' to ' },
    { type: 'text', text: 'review', marks: [{ type: 'strong' }] },
    { type: 'text', text: ' it', marks: [{ type: 'underline' }] },
    { type: 'text', text: ' now', marks: [{ type: 'strike' }] },
    { type: 'hardBreak' },
    {
      type: 'text',
      text: 'the spec',
      marks: [{ type: 'link', attrs: { href: 'https://x.test/s' } }]
    }
  ]);
  assert.equal(document.content[2].type, 'bulletList');
  assert.deepEqual(document.content[2].content[0], {
    type: 'listItem',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'renew on staging' }] }]
  });
  assert.equal(document.content[3].type, 'orderedList');
  assert.equal(document.content[5].type, 'blockquote');
  assert.deepEqual(document.content[6], {
    type: 'codeBlock',
    content: [{ type: 'text', text: 'npm run dist' }]
  });
});

test('a task list carries the ticks and the ids Jira insists on', () => {
  const list = documentFromRich(RICH).content[4];

  assert.equal(list.type, 'taskList');
  assert.equal(typeof list.attrs.localId, 'string');
  assert.equal(list.content[0].type, 'taskItem');
  assert.equal(list.content[0].attrs.state, 'DONE');
  assert.equal(list.content[1].attrs.state, 'TODO');
  assert.notEqual(list.content[0].attrs.localId, list.content[1].attrs.localId);
  assert.deepEqual(list.content[0].content, [{ type: 'text', text: 'shipped' }]);
});

test('documentFromRich returns null when there is nothing to send', () => {
  assert.equal(documentFromRich(null), null);
  assert.equal(documentFromRich({ blocks: [] }), null);
  assert.equal(documentFromRich({ blocks: [{ kind: 'paragraph', spans: [{ text: '' }] }] }), null);
  assert.equal(documentFromRich({ blocks: [{ kind: 'list', items: [{ spans: [] }] }] }), null);
});

test('documentFromRich keeps headings inside the levels Jira offers', () => {
  const deep = documentFromRich({ blocks: [{ kind: 'heading', level: 9, spans: [{ text: 'x' }] }] });
  assert.equal(deep.content[0].attrs.level, 3);
});

test('a document survives the trip out and back', () => {
  const back = richFromDocument(documentFromRich(RICH));
  assert.deepEqual(back.blocks, RICH.blocks);
  assert.equal(back.supported, true);
});

test('richFromDocument reads marks, mentions and lists back into spans', () => {
  const back = richFromDocument(documentFromRich(RICH));

  assert.deepEqual(back.blocks[1].spans[1], { mention: { id: 'acc-9', label: '@Sara Ali' } });
  assert.equal(back.blocks[1].spans[3].bold, true);
  assert.equal(back.blocks[1].spans[4].underline, true);
  assert.equal(back.blocks[1].spans[5].strike, true);
  assert.equal(back.blocks[1].spans[7].link, 'https://x.test/s');
  assert.deepEqual(back.blocks[4].items[0], { spans: [{ text: 'shipped' }], done: true });
  assert.equal(back.blocks[6].text, 'npm run dist');
});

test('isSupported spots the shapes the editor cannot hold', () => {
  assert.equal(isSupported(documentFromRich(RICH)), true);
  assert.equal(isSupported({ type: 'doc', content: [{ type: 'table', content: [] }] }), false);
  assert.equal(
    isSupported({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'textColor' }] }] }
      ]
    }),
    false
  );
  assert.equal(isSupported({ type: 'doc', content: [{ type: 'mediaSingle', content: [] }] }), true);
  assert.equal(isSupported({ type: 'doc', content: [{ type: 'panel', content: [] }] }), false);
});

test('an image travels as an external media node and reads back', () => {
  const doc = {
    blocks: [{ kind: 'image', url: 'https://x.test/rest/api/3/attachment/content/7', alt: 'shot.png' }]
  };
  const document = documentFromRich(doc);

  assert.deepEqual(document.content[0], {
    type: 'mediaSingle',
    attrs: { layout: 'center' },
    content: [
      {
        type: 'media',
        attrs: { type: 'external', url: 'https://x.test/rest/api/3/attachment/content/7', alt: 'shot.png' }
      }
    ]
  });
  assert.deepEqual(richFromDocument(document).blocks, doc.blocks);
});

test('an image Jira holds by file id comes back named, for the attachment list to resolve', () => {
  const document = {
    type: 'doc',
    content: [
      {
        type: 'mediaSingle',
        content: [{ type: 'media', attrs: { type: 'file', id: 'uuid-1', alt: 'shot.png' } }]
      }
    ]
  };
  assert.deepEqual(richFromDocument(document).blocks, [
    { kind: 'image', alt: 'shot.png', name: 'shot.png' }
  ]);
});

test('richTextOf flattens a rich document for anywhere plain text is wanted', () => {
  assert.equal(
    richTextOf(RICH),
    'Steps\nask @Sara Ali to review it now\nthe spec\n' +
      'renew on staging\nthen production\nfirst\nshipped\npending\nas agreed\nnpm run dist'
  );
});
