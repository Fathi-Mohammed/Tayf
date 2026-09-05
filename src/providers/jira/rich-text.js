'use strict';

const { randomUUID } = require('node:crypto');

const MARK_NAMES = {
  bold: 'strong',
  italic: 'em',
  underline: 'underline',
  strike: 'strike',
  code: 'code'
};
const MARK_FIELDS = {
  strong: 'bold',
  em: 'italic',
  underline: 'underline',
  strike: 'strike',
  code: 'code'
};
const LIST_NODES = { bullet: 'bulletList', ordered: 'orderedList', task: 'taskList' };
const LIST_VARIANTS = { bulletList: 'bullet', orderedList: 'ordered', taskList: 'task' };
const KNOWN_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'taskList',
  'listItem',
  'taskItem',
  'text',
  'hardBreak',
  'mention',
  'mediaSingle',
  'mediaGroup',
  'media'
]);
const SUPPORTED_MARKS = new Set(Object.values(MARK_NAMES).concat('link'));
const MAX_HEADING = 3;

function spanMarks(span) {
  const marks = Object.keys(MARK_NAMES)
    .filter((name) => span[name])
    .map((name) => ({ type: MARK_NAMES[name] }));

  if (span.link) marks.push({ type: 'link', attrs: { href: span.link } });
  return marks;
}

function spanToNode(span) {
  if (!span) return null;
  if (span.br) return { type: 'hardBreak' };
  if (span.mention) {
    return { type: 'mention', attrs: { id: span.mention.id, text: span.mention.label } };
  }

  const text = String(span.text == null ? '' : span.text);
  if (!text) return null;

  const marks = spanMarks(span);
  return marks.length ? { type: 'text', text, marks } : { type: 'text', text };
}

function spansToNodes(spans) {
  return (spans || []).map(spanToNode).filter(Boolean);
}

function spansToText(spans) {
  return (spans || [])
    .map((span) => (span.br ? '\n' : span.mention ? span.mention.label : span.text || ''))
    .join('');
}

function itemNode(item, variant) {
  const content = spansToNodes(item.spans);
  if (!content.length) return null;

  if (variant === 'task') {
    return {
      type: 'taskItem',
      attrs: { localId: randomUUID(), state: item.done ? 'DONE' : 'TODO' },
      content
    };
  }
  return { type: 'listItem', content: [{ type: 'paragraph', content }] };
}

function listNode(block) {
  const variant = block.variant || 'bullet';
  const items = (block.items || []).map((item) => itemNode(item, variant)).filter(Boolean);
  if (!items.length) return null;

  const node = { type: LIST_NODES[variant] || LIST_NODES.bullet, content: items };
  if (variant === 'task') node.attrs = { localId: randomUUID() };
  return node;
}

function imageNode(block) {
  if (!block.url) return null;
  const attrs = { type: 'external', url: block.url };
  if (block.alt) attrs.alt = block.alt;
  return {
    type: 'mediaSingle',
    attrs: { layout: 'center' },
    content: [{ type: 'media', attrs }]
  };
}

function blockToNode(block) {
  if (!block) return null;
  if (block.kind === 'image') return imageNode(block);
  if (block.kind === 'list') return listNode(block);

  if (block.kind === 'code') {
    const text = String(block.text || '');
    return text.trim() ? { type: 'codeBlock', content: [{ type: 'text', text }] } : null;
  }

  const content = spansToNodes(block.spans);
  if (!content.length) return null;

  if (block.kind === 'heading') {
    const level = Math.min(Math.max(Number(block.level) || 1, 1), MAX_HEADING);
    return { type: 'heading', attrs: { level }, content };
  }
  if (block.kind === 'quote') {
    return { type: 'blockquote', content: [{ type: 'paragraph', content }] };
  }
  return { type: 'paragraph', content };
}

function documentFromRich(doc) {
  const content = ((doc && doc.blocks) || []).map(blockToNode).filter(Boolean);
  if (!content.length) return null;
  return { type: 'doc', version: 1, content };
}

function richTextOf(doc) {
  return ((doc && doc.blocks) || [])
    .map((block) => {
      if (block.kind === 'image') return block.alt || '[image]';
      if (block.kind === 'code') return String(block.text || '');
      if (block.kind === 'list') {
        return (block.items || []).map((item) => spansToText(item.spans)).join('\n');
      }
      return spansToText(block.spans);
    })
    .join('\n')
    .trim();
}

function markedSpan(node) {
  const span = { text: node.text || '' };
  (node.marks || []).forEach((mark) => {
    if (MARK_FIELDS[mark.type]) span[MARK_FIELDS[mark.type]] = true;
    if (mark.type === 'link') span.link = (mark.attrs && mark.attrs.href) || '';
  });
  return span;
}

function nodeToSpans(node) {
  if (!node) return [];
  if (node.type === 'text') return [markedSpan(node)];
  if (node.type === 'hardBreak') return [{ br: true }];
  if (node.type === 'mention') {
    const attrs = node.attrs || {};
    return [{ mention: { id: attrs.id || '', label: attrs.text || '@user' } }];
  }
  return (node.content || []).flatMap(nodeToSpans);
}

function innerSpans(node) {
  return (node.content || []).flatMap((child, index) => {
    const spans = nodeToSpans(child);
    return index ? [{ br: true }, ...spans] : spans;
  });
}

function itemFromNode(node) {
  const item = { spans: nodeToSpans(node) };
  if (node.type === 'taskItem') item.done = (node.attrs && node.attrs.state) === 'DONE';
  return item;
}

function imageBlock(node) {
  const media = (node.content || []).find((child) => child.type === 'media') || node;
  const attrs = media.attrs || {};
  const block = { kind: 'image', alt: attrs.alt || '' };
  if (attrs.type === 'external') block.url = attrs.url || '';
  else block.name = attrs.alt || '';
  return block;
}

function nodeToBlock(node) {
  if (node.type === 'mediaSingle' || node.type === 'mediaGroup' || node.type === 'media') {
    return imageBlock(node);
  }
  if (node.type === 'heading') {
    return {
      kind: 'heading',
      level: (node.attrs && node.attrs.level) || 1,
      spans: nodeToSpans(node)
    };
  }
  if (node.type === 'blockquote') return { kind: 'quote', spans: innerSpans(node) };
  if (node.type === 'codeBlock') {
    return { kind: 'code', text: (node.content || []).map((child) => child.text || '').join('') };
  }
  if (LIST_VARIANTS[node.type]) {
    return {
      kind: 'list',
      variant: LIST_VARIANTS[node.type],
      items: (node.content || []).map(itemFromNode)
    };
  }
  return { kind: 'paragraph', spans: nodeToSpans(node) };
}

function isSupported(node) {
  if (!node || typeof node !== 'object') return true;
  if (node.type && !KNOWN_NODES.has(node.type)) return false;
  if ((node.marks || []).some((mark) => !SUPPORTED_MARKS.has(mark.type))) return false;
  return (node.content || []).every(isSupported);
}

function richFromDocument(document) {
  return {
    blocks: ((document && document.content) || []).map(nodeToBlock),
    supported: isSupported(document)
  };
}

module.exports = { documentFromRich, richFromDocument, richTextOf, isSupported };
