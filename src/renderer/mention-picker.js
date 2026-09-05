import elements from './elements.js';
import { escapeHtml } from './format.js';

const TRIGGER = /(?:^|\s)@([^@\n]{0,40})$/;
const MAX_ROWS = 6;
const EDGE_GAP = 8;
const ROW_GAP = 6;
const FALLBACK_HEIGHT = 120;

const usersByProject = new Map();
const picker = {
  open: false,
  projectKey: null,
  matches: [],
  highlighted: 0,
  at: -1,
  picked: []
};

export function isOpen() {
  return picker.open;
}

export function pickedMentions() {
  return picker.picked;
}

export function resetMentions(projectKey) {
  picker.projectKey = projectKey || null;
  picker.picked = [];
  closePicker();
}

export function closePicker() {
  picker.open = false;
  picker.matches = [];
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

function place() {
  const box = elements.vcin.getBoundingClientRect();
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

export function choosePicker() {
  const user = picker.matches[picker.highlighted];
  if (!user) {
    closePicker();
    return;
  }

  const box = elements.vcin;
  const label = `@${user.name}`;
  const after = box.value.slice(box.selectionStart);
  const caret = picker.at + label.length + 1;

  box.value = `${box.value.slice(0, picker.at)}${label} ${after}`;
  box.setSelectionRange(caret, caret);

  if (!picker.picked.some((one) => one.text === label)) {
    picker.picked.push({ text: label, accountId: user.accountId });
  }

  closePicker();
  box.focus();
}

async function onInput() {
  const box = elements.vcin;
  const typed = box.value.slice(0, box.selectionStart).match(TRIGGER);
  if (!typed) {
    closePicker();
    return;
  }

  const query = typed[1].toLowerCase();
  const users = await knownUsers();
  const matches = users
    .filter((user) => user.name.toLowerCase().includes(query))
    .slice(0, MAX_ROWS);

  if (!matches.length) {
    closePicker();
    return;
  }

  picker.at = box.selectionStart - typed[1].length - 1;
  picker.matches = matches;
  picker.highlighted = 0;
  picker.open = true;
  draw();
}

elements.vcin.addEventListener('input', onInput);
elements.vcin.addEventListener('blur', () => closePicker());

elements.mentions.addEventListener('mousedown', (event) => {
  const row = event.target.closest('.mrow');
  if (!row) return;
  event.preventDefault();
  picker.highlighted = Number(row.dataset.i);
  choosePicker();
});
