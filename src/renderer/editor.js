const HEADING = /^H([1-3])$/;
const MARK_TAGS = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  S: 'strike',
  STRIKE: 'strike',
  DEL: 'strike',
  CODE: 'code'
};
const MARK_ORDER = ['code', 'strike', 'underline', 'italic', 'bold'];
const MARK_ELEMENTS = { code: 'code', strike: 's', underline: 'u', italic: 'em', bold: 'strong' };
const BLOCK_SELECTOR = 'p, h1, h2, h3, li, blockquote, pre';
const MAX_HEADING = 3;
const TASK_DONE = 'true';
const ZERO_WIDTH = '\u200b';
const BLANK_MARKS = /[\u200b☐☑]/g;

const INPUT_RULES = [
  { pattern: /^[-*]$/, run: (block) => intoList(block, 'bullet') },
  { pattern: /^\d+\.$/, run: (block) => intoList(block, 'ordered') },
  { pattern: /^\[[ xX]?\]$/, run: (block) => intoList(block, 'task') },
  { pattern: /^(#{1,3})$/, run: (block, hit) => intoBlock(block, `h${hit[1].length}`) },
  { pattern: /^>$/, run: (block) => intoBlock(block, 'blockquote') },
  { pattern: /^```$/, run: (block) => intoBlock(block, 'pre') }
];

const ICONS = {
  code: '<path d="M6 4.2 2.6 8 6 11.8M10 4.2 13.4 8 10 11.8" />',
  bullet:
    '<path d="M6 4h7.6M6 8h7.6M6 12h7.6" />' +
    '<circle cx="3" cy="4" r=".9" fill="currentColor" stroke="none" />' +
    '<circle cx="3" cy="8" r=".9" fill="currentColor" stroke="none" />' +
    '<circle cx="3" cy="12" r=".9" fill="currentColor" stroke="none" />',
  ordered:
    '<path d="M6 4h7.6M6 8h7.6M6 12h7.6" />' +
    '<path d="M2.2 3.2 3 2.8v2.6M2 11h1.8L2 13h1.9" />',
  task:
    '<path d="M6.6 4h7M6.6 8h7M6.6 12h7" />' +
    '<path d="M1.6 3.9 2.6 5l1.9-2M1.6 7.9 2.6 9l1.9-2M1.6 11.9 2.6 13l1.9-2" />',
  quote:
    '<path d="M6.4 5.2c-1.7 0-2.9 1.1-2.9 2.6 0 1.3.9 2.2 2.1 2.2 1 0 1.8-.6 1.8-1.5' +
    'M13.4 5.2c-1.7 0-2.9 1.1-2.9 2.6 0 1.3.9 2.2 2.1 2.2 1 0 1.8-.6 1.8-1.5" />',
  image:
    '<rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.6" />' +
    '<path d="M2.6 10.6 5.8 7.9l2.7 2.3 2-1.6 2.9 2.4" />' +
    '<circle cx="10.4" cy="6.2" r="1" />',
  mention:
    '<circle cx="8" cy="8" r="2.6" />' +
    '<path d="M10.6 6.6v2.7c0 1 .7 1.6 1.6 1.6 1.1 0 1.8-.9 1.8-2.3A6 6 0 1 0 11.4 13" />'
};

const TOOLS = [
  { id: 'bold', label: 'B', title: 'عريض · Ctrl+B' },
  { id: 'italic', label: 'I', title: 'مايل · Ctrl+I' },
  { id: 'underline', label: 'U', title: 'تحته خط · Ctrl+U' },
  { id: 'strike', label: 'S', title: 'مشطوب · Ctrl+Shift+S' },
  { id: 'code', icon: ICONS.code, title: 'كود · Ctrl+Shift+M' },
  { gap: true },
  { id: 'bullet', icon: ICONS.bullet, title: 'نقط · Ctrl+Shift+8' },
  { id: 'ordered', icon: ICONS.ordered, title: 'ترقيم · Ctrl+Shift+7' },
  { id: 'task', icon: ICONS.task, title: 'تشيك ليست · Ctrl+Shift+6' },
  { id: 'quote', icon: ICONS.quote, title: 'اقتباس · > في أول السطر' },
  { gap: true },
  { id: 'image', icon: ICONS.image, title: 'صورة — أو الزقها على طول' },
  { id: 'mention', icon: ICONS.mention, title: 'منشن — أو اكتب @' }
];

const SHORTCUTS = {
  'shift+KeyS': 'strike',
  'shift+KeyM': 'code',
  'shift+Digit8': 'bullet',
  'shift+Digit7': 'ordered',
  'shift+Digit6': 'task',
  KeyE: 'code'
};

const imageTools = new WeakMap();
const imageData = new Map();

let separatorSet = false;

export function setImageTools(element, tools) {
  imageTools.set(element, tools || {});
}

function toolsFor(element) {
  return imageTools.get(element) || {};
}

async function paintImage(image, url) {
  if (imageData.has(url)) {
    image.src = imageData.get(url);
    return;
  }

  const response = await window.tayf.image(url);
  if (!response || !response.data) return;
  imageData.set(url, response.data);
  image.src = response.data;
}

function command(name, value) {
  document.execCommand(name, false, value === undefined ? null : value);
}

function spanOf(rawText, marks) {
  const span = { text: rawText.replace(/\u00a0/g, ' ').replace(/\u200b/g, '') };
  MARK_ORDER.forEach((name) => {
    if (marks[name]) span[name] = true;
  });
  if (marks.link) span.link = marks.link;
  return span;
}

function sameMarks(one, two) {
  if (one.mention || two.mention || one.br || two.br) return false;
  if ((one.link || '') !== (two.link || '')) return false;
  return MARK_ORDER.every((name) => !!one[name] === !!two[name]);
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
  if (node.classList.contains('tick')) return [];
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

function listVariant(list) {
  if (list.tagName === 'OL') return 'ordered';
  return list.classList.contains('task') ? 'task' : 'bullet';
}

function readBlock(node) {
  const tag = node.tagName;

  if (tag === 'UL' || tag === 'OL') {
    const variant = listVariant(node);
    return {
      kind: 'list',
      variant,
      items: [...node.children].map((item) => {
        const entry = { spans: spansOf(item) };
        if (variant === 'task') entry.done = item.dataset.done === TASK_DONE;
        return entry;
      })
    };
  }
  if (tag === 'IMG') {
    return { kind: 'image', url: node.dataset.url || '', alt: node.getAttribute('alt') || '' };
  }
  if (tag === 'PRE') return { kind: 'code', text: node.textContent };
  if (tag === 'BLOCKQUOTE') return { kind: 'quote', spans: spansOf(node) };

  const heading = HEADING.exec(tag);
  if (heading) return { kind: 'heading', level: Number(heading[1]), spans: spansOf(node) };

  return { kind: 'paragraph', spans: spansOf(node) };
}

function hasContent(block) {
  if (block.kind === 'image') return !!block.url;
  if (block.kind === 'code') return !!block.text.trim();
  if (block.kind === 'list') return block.items.some((item) => item.spans.length);
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

function tickElement(done) {
  const tick = document.createElement('span');
  tick.className = 'tick';
  tick.contentEditable = 'false';
  tick.textContent = done ? '☑' : '☐';
  return tick;
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
  MARK_ORDER.forEach((name) => {
    if (span[name]) node = wrap(MARK_ELEMENTS[name], node);
  });
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

function itemElement(item, variant) {
  const element = document.createElement('li');
  if (variant === 'task') {
    element.dataset.done = item.done ? TASK_DONE : 'false';
    element.appendChild(tickElement(item.done));
  }
  return fill(element, item.spans);
}

function imageElement(block, resolve) {
  const image = document.createElement('img');
  image.className = 'shot';
  image.alt = block.alt || '';
  image.contentEditable = 'false';

  const url = block.url || (resolve ? resolve(block) : '');
  if (url) {
    image.dataset.url = url;
    paintImage(image, url);
  }
  return image;
}

function blockElement(block, resolve) {
  if (block.kind === 'image') return imageElement(block, resolve);
  if (block.kind === 'list') {
    const variant = block.variant || 'bullet';
    const list = document.createElement(variant === 'ordered' ? 'ol' : 'ul');
    if (variant === 'task') list.className = 'task';
    (block.items || []).forEach((item) => list.appendChild(itemElement(item, variant)));
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
  const { resolve } = toolsFor(element);
  ((doc && doc.blocks) || []).forEach((block) => element.appendChild(blockElement(block, resolve)));
  if (!element.childNodes.length) element.appendChild(fill(document.createElement('p'), []));
  markEmpty(element);
}

export function isEmpty(element) {
  return !element.textContent.replace(BLANK_MARKS, '').trim() && !element.querySelector('.men');
}

export function markEmpty(element) {
  element.classList.toggle('blank', isEmpty(element));
}

export function clearEditor(element) {
  writeDoc(element, null);
}

function caretInto(node) {
  const caret = document.createRange();
  caret.selectNodeContents(node);
  caret.collapse(false);

  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(caret);
}

function keepCaret(target) {
  const selection = document.getSelection();
  if (selection && selection.anchorNode && target.contains(selection.anchorNode)) return;
  caretInto(target);
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
  while (from.firstChild) {
    const child = from.firstChild;
    if (child.nodeType === Node.ELEMENT_NODE && child.classList.contains('tick')) child.remove();
    else to.appendChild(child);
  }
  if (!to.childNodes.length) to.appendChild(document.createElement('br'));
  return to;
}

function listItemFrom(block, variant) {
  const item = moveChildren(block, document.createElement('li'));
  if (variant === 'task') {
    item.dataset.done = 'false';
    item.prepend(tickElement(false));
  }
  return item;
}

function intoList(block, variant) {
  const list = document.createElement(variant === 'ordered' ? 'ol' : 'ul');
  if (variant === 'task') list.className = 'task';

  const item = listItemFrom(block, variant);
  list.appendChild(item);
  block.replaceWith(list);
  keepCaret(item);
}

function intoBlock(block, tag) {
  const next = moveChildren(block, document.createElement(tag));
  block.replaceWith(next);
  keepCaret(next);
}

function outOfList(list) {
  const blocks = [...list.children].map((item) => moveChildren(item, document.createElement('p')));
  list.replaceWith(...blocks);
  keepCaret(blocks[blocks.length - 1]);
}

function convertList(list, variant) {
  const next = document.createElement(variant === 'ordered' ? 'ol' : 'ul');
  if (variant === 'task') next.className = 'task';

  [...list.children].forEach((item) => next.appendChild(listItemFrom(item, variant)));
  list.replaceWith(next);
  keepCaret(next.lastElementChild || next);
}

function blockOf(element, node) {
  const start = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!start || !element.contains(start)) return null;
  const block = start.closest(BLOCK_SELECTOR);
  return block && element.contains(block) ? block : null;
}

function currentBlock(element) {
  const selection = document.getSelection();
  if (!selection || !selection.anchorNode) return null;
  return blockOf(element, selection.anchorNode);
}

function applyInputRule(element) {
  const selection = document.getSelection();
  if (!selection || !selection.isCollapsed || !selection.anchorNode) return false;

  const block = blockOf(element, selection.anchorNode);
  if (!block || block.tagName === 'LI' || block.tagName === 'PRE') return false;

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

function caretAfter(node) {
  const caret = document.createRange();
  caret.setStartAfter(node);
  caret.collapse(true);

  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(caret);
}

function toggleCode() {
  const selection = document.getSelection();
  if (!selection || !selection.rangeCount || !selection.anchorNode) return;

  const holder = selection.anchorNode.parentElement;
  const inside = holder && holder.closest('code');

  if (inside && selection.isCollapsed) {
    const after = document.createTextNode(ZERO_WIDTH);
    inside.after(after);
    caretAfter(after);
    return;
  }
  if (inside) {
    inside.replaceWith(document.createTextNode(inside.textContent));
    return;
  }

  const range = selection.getRangeAt(0);
  const code = document.createElement('code');

  if (selection.isCollapsed) {
    code.textContent = ZERO_WIDTH;
    range.insertNode(code);
    caretInto(code);
    return;
  }

  code.appendChild(range.extractContents());
  range.insertNode(code);
  caretInto(code);
}

function listTool(element, variant) {
  const block = currentBlock(element);
  if (!block) return;

  const item = block.tagName === 'LI' ? block : block.closest('li');
  if (!item) {
    intoList(block, variant);
    return;
  }

  const list = item.parentElement;
  if (listVariant(list) === variant) outOfList(list);
  else convertList(list, variant);
}

function quoteTool(element) {
  const block = currentBlock(element);
  if (!block || block.tagName === 'LI') return;
  intoBlock(block, block.tagName === 'BLOCKQUOTE' ? 'p' : 'blockquote');
}

const TOOL_ACTIONS = {
  bold: () => command('bold'),
  italic: () => command('italic'),
  underline: () => command('underline'),
  strike: () => command('strikeThrough'),
  code: () => toggleCode(),
  bullet: (element) => listTool(element, 'bullet'),
  ordered: (element) => listTool(element, 'ordered'),
  task: (element) => listTool(element, 'task'),
  quote: (element) => quoteTool(element),
  image: (element) => pickImage(element),
  mention: () => command('insertText', '@')
};

function runTool(element, id) {
  const action = TOOL_ACTIONS[id];
  if (!action) return;
  action(element);
  markEmpty(element);
}

function onKeydown(event) {
  const element = event.currentTarget;

  if (event.key === ' ' && applyInputRule(element)) {
    event.preventDefault();
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;

  const tool = SHORTCUTS[`${event.shiftKey ? 'shift+' : ''}${event.code}`];
  if (!tool) return;

  event.preventDefault();
  runTool(element, tool);
}

function onClick(event) {
  const item = event.target.closest('li[data-done]');
  if (!item || !event.target.classList.contains('tick')) return;

  const done = item.dataset.done !== TASK_DONE;
  item.dataset.done = done ? TASK_DONE : 'false';
  event.target.textContent = done ? '☑' : '☐';
}

function insertImage(element, source, url, alt) {
  const image = document.createElement('img');
  image.className = 'shot';
  image.contentEditable = 'false';
  image.alt = alt || '';
  image.src = source;
  if (url) image.dataset.url = url;

  const selection = document.getSelection();
  const block = currentBlock(element);
  if (block) block.after(image);
  else element.appendChild(image);

  if (!image.nextElementSibling) {
    element.appendChild(fill(document.createElement('p'), []));
  }
  if (selection) caretInto(image.nextElementSibling);
  markEmpty(element);
  return image;
}

function asDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => resolve(''));
    reader.readAsDataURL(file);
  });
}

async function storeImage(element, file, preview) {
  const { upload, onProblem } = toolsFor(element);
  if (!upload) {
    if (onProblem) onProblem();
    return;
  }

  const shown = insertImage(element, preview, '', file.name);
  const stored = await upload(file);
  if (!stored) {
    shown.remove();
    markEmpty(element);
    return;
  }

  shown.dataset.url = stored.url;
  if (preview) imageData.set(stored.url, preview);
  else paintImage(shown, stored.url);
}

async function takeImage(element, file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name || `لزقة-${Date.now()}.png`;
  const preview = await asDataUrl(file);

  return storeImage(element, { name, mime: file.type || 'image/png', bytes }, preview);
}

function pastedImage(event) {
  const items = [...((event.clipboardData && event.clipboardData.files) || [])];
  return items.find((file) => file.type.startsWith('image/')) || null;
}

function onPaste(event) {
  const image = pastedImage(event);
  if (image) {
    event.preventDefault();
    takeImage(event.currentTarget, image);
    return;
  }

  event.preventDefault();
  const text = (event.clipboardData && event.clipboardData.getData('text/plain')) || '';
  if (text) command('insertText', text);
}

async function pickImage(element) {
  const { upload, onProblem } = toolsFor(element);
  if (!upload) {
    if (onProblem) onProblem();
    return;
  }

  const chosen = await window.tayf.pickImage();
  if (!chosen || !chosen.file) return;

  element.focus();
  await storeImage(element, chosen.file, '');
}

function toolElement(tool) {
  if (tool.gap) {
    const gap = document.createElement('span');
    gap.className = 'egap';
    return gap;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.tool = tool.id;
  button.title = tool.title;

  if (tool.icon) {
    button.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" ' +
      `stroke-linecap="round" stroke-linejoin="round">${tool.icon}</svg>`;
    return button;
  }

  const glyph = document.createElement('span');
  glyph.className = `glyph ${tool.id}`;
  glyph.textContent = tool.label;
  button.appendChild(glyph);
  return button;
}

function buildToolbar(element) {
  const bar = document.createElement('div');
  bar.className = 'etools';

  TOOLS.forEach((tool) => bar.appendChild(toolElement(tool)));

  bar.addEventListener('mousedown', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    event.preventDefault();
    element.focus();
    runTool(element, button.dataset.tool);
  });

  const holder = document.createElement('div');
  holder.className = 'ewrap';
  element.replaceWith(holder);
  holder.append(bar, element);
}

export function installEditor(element) {
  if (!separatorSet) {
    command('defaultParagraphSeparator', 'p');
    separatorSet = true;
  }

  buildToolbar(element);
  element.addEventListener('keydown', onKeydown);
  element.addEventListener('paste', onPaste);
  element.addEventListener('click', onClick);
  element.addEventListener('input', () => markEmpty(element));
  writeDoc(element, null);
}
