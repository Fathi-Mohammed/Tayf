const HEADING = /^H([1-3])$/;
const MARK_TAGS = { B: 'bold', STRONG: 'bold', I: 'italic', EM: 'italic', CODE: 'code' };
const BLOCK_SELECTOR = 'p, h1, h2, h3, li, blockquote, pre';
const NO_RULES = new Set(['LI', 'PRE']);
const MAX_HEADING = 3;

const INPUT_RULES = [
  { pattern: /^[-*]$/, run: (block) => intoList(block, false) },
  { pattern: /^\d+\.$/, run: (block) => intoList(block, true) },
  { pattern: /^(#{1,3})$/, run: (block, hit) => intoBlock(block, `h${hit[1].length}`) },
  { pattern: /^>$/, run: (block) => intoBlock(block, 'blockquote') },
  { pattern: /^```$/, run: (block) => intoBlock(block, 'pre') }
];

let separatorSet = false;

function spanOf(rawText, marks) {
  const span = { text: rawText.replace(/\u00a0/g, ' ') };
  if (marks.bold) span.bold = true;
  if (marks.italic) span.italic = true;
  if (marks.code) span.code = true;
  if (marks.link) span.link = marks.link;
  return span;
}

function sameMarks(one, two) {
  return (
    !one.mention &&
    !two.mention &&
    !one.br &&
    !two.br &&
    !!one.bold === !!two.bold &&
    !!one.italic === !!two.italic &&
    !!one.code === !!two.code &&
    (one.link || '') === (two.link || '')
  );
}

function mergeSpans(spans) {
  return spans.reduce((merged, span) => {
    const last = merged[merged.length - 1];
    if (last && sameMarks(last, span)) last.text += span.text;
    else merged.push({ ...span });
    return merged;
  }, []);
}

function inlineSpans(node, marks) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue ? [spanOf(node.nodeValue, marks)] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  if (node.tagName === 'BR') return [{ br: true }];
  if (node.classList.contains('men')) {
    return [{ mention: { id: node.dataset.id || '', label: node.textContent } }];
  }

  const next = { ...marks };
  if (MARK_TAGS[node.tagName]) next[MARK_TAGS[node.tagName]] = true;
  if (node.tagName === 'A') next.link = node.getAttribute('href') || '';

  return [...node.childNodes].flatMap((child) => inlineSpans(child, next));
}

function spansOf(node) {
  return mergeSpans(inlineSpans(node, {}));
}

function readBlock(node) {
  const tag = node.tagName;

  if (tag === 'UL' || tag === 'OL') {
    return { kind: 'list', ordered: tag === 'OL', items: [...node.children].map(spansOf) };
  }
  if (tag === 'PRE') return { kind: 'code', text: node.textContent };
  if (tag === 'BLOCKQUOTE') return { kind: 'quote', spans: spansOf(node) };

  const heading = HEADING.exec(tag);
  if (heading) return { kind: 'heading', level: Number(heading[1]), spans: spansOf(node) };

  return { kind: 'paragraph', spans: spansOf(node) };
}

function hasContent(block) {
  if (block.kind === 'code') return !!block.text.trim();
  if (block.kind === 'list') return block.items.some((spans) => spans.length);
  return block.spans.some((span) => span.mention || (span.text || '').trim());
}

export function readDoc(element) {
  const blocks = [];

  [...element.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue.trim()) {
        blocks.push({ kind: 'paragraph', spans: [{ text: node.nodeValue }] });
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) blocks.push(readBlock(node));
  });

  return { blocks: blocks.filter(hasContent) };
}

export function mentionChip(id, label) {
  const chip = document.createElement('span');
  chip.className = 'men';
  chip.dir = 'auto';
  chip.dataset.id = id;
  chip.contentEditable = 'false';
  chip.textContent = label;
  return chip;
}

function wrap(tag, child) {
  const element = document.createElement(tag);
  element.appendChild(child);
  return element;
}

function spanElement(span) {
  if (span.br) return document.createElement('br');
  if (span.mention) return mentionChip(span.mention.id, span.mention.label);

  let node = document.createTextNode(span.text || '');
  if (span.code) node = wrap('code', node);
  if (span.italic) node = wrap('em', node);
  if (span.bold) node = wrap('strong', node);
  if (span.link) {
    const link = wrap('a', node);
    link.setAttribute('href', span.link);
    node = link;
  }
  return node;
}

function fill(element, spans) {
  (spans || []).forEach((span) => element.appendChild(spanElement(span)));
  if (!element.childNodes.length) element.appendChild(document.createElement('br'));
  return element;
}

function blockElement(block) {
  if (block.kind === 'list') {
    const list = document.createElement(block.ordered ? 'ol' : 'ul');
    (block.items || []).forEach((spans) => {
      list.appendChild(fill(document.createElement('li'), spans));
    });
    return list;
  }
  if (block.kind === 'code') {
    const pre = document.createElement('pre');
    pre.textContent = block.text || '';
    return pre;
  }
  if (block.kind === 'heading') {
    const level = Math.min(Math.max(block.level || 1, 1), MAX_HEADING);
    return fill(document.createElement(`h${level}`), block.spans);
  }
  if (block.kind === 'quote') return fill(document.createElement('blockquote'), block.spans);
  return fill(document.createElement('p'), block.spans);
}

export function writeDoc(element, doc) {
  element.innerHTML = '';
  ((doc && doc.blocks) || []).forEach((block) => element.appendChild(blockElement(block)));
  if (!element.childNodes.length) element.appendChild(fill(document.createElement('p'), []));
  markEmpty(element);
}

export function isEmpty(element) {
  return !element.textContent.trim() && !element.querySelector('.men');
}

export function markEmpty(element) {
  element.classList.toggle('blank', isEmpty(element));
}

export function clearEditor(element) {
  writeDoc(element, null);
}

function caretInto(node) {
  const caret = document.createRange();
  caret.setStart(node, 0);
  caret.collapse(true);

  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(caret);
}

export function focusEditor(element) {
  element.focus();

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);

  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function moveChildren(from, to) {
  while (from.firstChild) to.appendChild(from.firstChild);
  if (!to.childNodes.length) to.appendChild(document.createElement('br'));
  return to;
}

function intoList(block, ordered) {
  const list = document.createElement(ordered ? 'ol' : 'ul');
  const item = moveChildren(block, document.createElement('li'));
  list.appendChild(item);
  block.replaceWith(list);
  caretInto(item);
}

function intoBlock(block, tag) {
  const next = moveChildren(block, document.createElement(tag));
  block.replaceWith(next);
  caretInto(next);
}

function blockOf(element, node) {
  const start = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!start || !element.contains(start)) return null;
  const block = start.closest(BLOCK_SELECTOR);
  return block && element.contains(block) ? block : null;
}

function applyInputRule(element) {
  const selection = document.getSelection();
  if (!selection || !selection.isCollapsed || !selection.anchorNode) return false;

  const block = blockOf(element, selection.anchorNode);
  if (!block || NO_RULES.has(block.tagName)) return false;

  const range = document.createRange();
  range.setStart(block, 0);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  const prefix = range.toString();

  for (const rule of INPUT_RULES) {
    const hit = rule.pattern.exec(prefix);
    if (!hit) continue;
    range.deleteContents();
    rule.run(block, hit);
    return true;
  }
  return false;
}

function toggleCode() {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed) return;

  const inside = selection.anchorNode.parentElement.closest('code');
  if (inside) {
    inside.replaceWith(document.createTextNode(inside.textContent));
    return;
  }

  const range = selection.getRangeAt(0);
  const code = document.createElement('code');
  code.appendChild(range.extractContents());
  range.insertNode(code);
}

function onKeydown(event) {
  if (event.key === ' ' && applyInputRule(event.currentTarget)) {
    event.preventDefault();
    return;
  }

  const modified = event.ctrlKey || event.metaKey;
  if (modified && !event.shiftKey && String(event.key).toLowerCase() === 'e') {
    event.preventDefault();
    toggleCode();
  }
}

function onPaste(event) {
  event.preventDefault();
  const text = (event.clipboardData && event.clipboardData.getData('text/plain')) || '';
  if (text) document.execCommand('insertText', false, text);
}

export function installEditor(element) {
  if (!separatorSet) {
    document.execCommand('defaultParagraphSeparator', false, 'p');
    separatorSet = true;
  }

  element.addEventListener('keydown', onKeydown);
  element.addEventListener('paste', onPaste);
  element.addEventListener('input', () => markEmpty(element));
  writeDoc(element, null);
}
