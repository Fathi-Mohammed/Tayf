'use strict';

const MARK_NAMES = { bold: 'strong', italic: 'em', code: 'code' };
const LIST_NODES = { true: 'orderedList', false: 'bulletList' };
const KNOWN_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'text',
  'hardBreak',
  'mention'
]);
const SUPPORTED_MARKS = new Set(['strong', 'em', 'code', 'link']);
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
    return {
      type: 'mention',
      attrs: { id: span.mention.id, text: span.mention.label }
    };
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

function listItemNode(spans) {
  return {
    type: 'listItem',
    content: [{ type: 'paragraph', content: spansToNodes(spans) }]
  };
}

function blockToNode(block) {
  if (!block) return null;

  if (block.kind === 'list') {
    const items = (block.items || []).map(listItemNode).filter((item) => item.content[0].content.length);
    if (!items.length) return null;
    return { type: LIST_NODES[String(!!block.ordered)], content: items };
  }

  if (block.kind === 'code') {
    const text = String(block.text || '');
    if (!text.trim()) return null;
    return { type: 'codeBlock', content: [{ type: 'text', text }] };
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
      if (block.kind === 'code') return String(block.text || '');
      if (block.kind === 'list') return (block.items || []).map(spansToText).join('\n');
      return spansToText(block.spans);
    })
    .join('\n')
    .trim();
}

function markedSpan(node) {
  const span = { text: node.text || '' };
  (node.marks || []).forEach((mark) => {
    if (mark.type === 'strong') span.bold = true;
    if (mark.type === 'em') span.italic = true;
    if (mark.type === 'code') span.code = true;
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

function nodeToBlock(node) {
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
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return {
      kind: 'list',
      ordered: node.type === 'orderedList',
      items: (node.content || []).map(nodeToSpans)
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
