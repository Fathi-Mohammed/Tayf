import elements from './elements.js';
import { escapeHtml } from './format.js';
import { mentionChip } from './editor.js';

const TRIGGER = /(?:^|\s)@([^@\n]{0,40})$/;
const MAX_ROWS = 6;
const EDGE_GAP = 8;
const ROW_GAP = 6;
const FALLBACK_HEIGHT = 120;

const usersByProject = new Map();
const picker = {
  open: false,
  projectKey: null,
  element: null,
  matches: [],
  highlighted: 0,
  spot: null
};

export function isOpen() {
  return picker.open;
}

export function resetMentions(projectKey) {
  picker.projectKey = projectKey || null;
  closePicker();
}

export function closePicker() {
  picker.open = false;
  picker.matches = [];
  picker.spot = null;
  picker.element = null;
  elements.mentions.innerHTML = '';
  elements.mentions.style.display = 'none';
}

async function knownUsers() {
  const { projectKey } = picker;
  if (!projectKey) return [];
  if (usersByProject.has(projectKey)) return usersByProject.get(projectKey);

  const response = await window.tayf.assignableUsers(projectKey);
  const users = (response.users || []).filter((user) => user.name);
  usersByProject.set(projectKey, users);
  return users;
}

function caretSpot(element) {
  const selection = document.getSelection();
  if (!selection || !selection.isCollapsed) return null;

  const node = selection.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE || !element.contains(node)) return null;

  const before = node.nodeValue.slice(0, selection.anchorOffset);
  const typed = TRIGGER.exec(before);
  if (!typed) return null;

  return {
    node,
    at: selection.anchorOffset - typed[1].length - 1,
    end: selection.anchorOffset,
    query: typed[1].toLowerCase()
  };
}

function place() {
  const box = picker.element.getBoundingClientRect();
  const height = elements.mentions.offsetHeight || FALLBACK_HEIGHT;

  elements.mentions.style.left = `${box.left}px`;
  elements.mentions.style.width = `${box.width}px`;
  elements.mentions.style.top = `${Math.max(EDGE_GAP, box.top - height - ROW_GAP)}px`;
}

function draw() {
  elements.mentions.innerHTML = picker.matches
    .map(
      (user, index) =>
        `<div class="mrow${index === picker.highlighted ? ' on' : ''}" data-i="${index}">` +
        `${escapeHtml(user.name)}</div>`
    )
    .join('');
  elements.mentions.style.display = 'block';
  place();
}

export function movePicker(delta) {
  picker.highlighted = Math.max(0, Math.min(picker.highlighted + delta, picker.matches.length - 1));
  draw();
}

function dropChip(range, user) {
  const chip = mentionChip(user.accountId, `@${user.name}`);
  range.insertNode(chip);

  const tail = document.createTextNode(' ');
  chip.after(tail);

  const caret = document.createRange();
  caret.setStart(tail, 1);
  caret.collapse(true);

  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(caret);
}

export function choosePicker() {
  const user = picker.matches[picker.highlighted];
  const { spot } = picker;
  if (!user || !spot) {
    closePicker();
    return;
  }

  const range = document.createRange();
  range.setStart(spot.node, spot.at);
  range.setEnd(spot.node, spot.end);
  range.deleteContents();
  dropChip(range, user);
  closePicker();
}

export function insertMention(element, user) {
  element.focus();

  const selection = document.getSelection();
  const inside =
    selection && selection.rangeCount && element.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : null;

  const range = inside || document.createRange();
  if (!inside) {
    range.selectNodeContents(element);
    range.collapse(false);
  }
  range.deleteContents();
  dropChip(range, user);
}

export function peopleFor(projectKey) {
  picker.projectKey = projectKey || picker.projectKey;
  return knownUsers();
}

async function onInput(element) {
  const spot = caretSpot(element);
  if (!spot) {
    closePicker();
    return;
  }

  const users = await knownUsers();
  const matches = users
    .filter((user) => user.name.toLowerCase().includes(spot.query))
    .slice(0, MAX_ROWS);

  if (!matches.length) {
    closePicker();
    return;
  }

  picker.element = element;
  picker.spot = spot;
  picker.matches = matches;
  picker.highlighted = 0;
  picker.open = true;
  draw();
}

export function attachMentions(element) {
  element.addEventListener('input', () => onInput(element));
  element.addEventListener('blur', () => closePicker());
}

elements.mentions.addEventListener('mousedown', (event) => {
  const row = event.target.closest('.mrow');
  if (!row) return;
  event.preventDefault();
  picker.highlighted = Number(row.dataset.i);
  choosePicker();
});
