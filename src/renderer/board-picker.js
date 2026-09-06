import { t, getLocale } from './i18n.js';
import elements from './elements.js';
import { state } from './state.js';
import { escapeHtml } from './format.js';

const ALL_BOARDS = { id: null, name: t("كل البوردات") };

let open = false;
let highlighted = 0;
let onPick = () => {};

export function boardOptions() {
  const seen = new Map();
  state.workspace.items.forEach((item) => {
    (item.boards || []).forEach((board) => {
      if (!seen.has(board.id)) seen.set(board.id, { id: board.id, name: board.name });
    });
  });
  const named = [...seen.values()].sort((first, second) =>
    String(first.name).localeCompare(String(second.name), getLocale())
  );
  return [ALL_BOARDS, ...named];
}

export function currentBoardName() {
  const found = boardOptions().find((board) => board.id === state.boardId);
  return (found || ALL_BOARDS).name;
}

export function isOpen() {
  return open;
}

function draw() {
  elements.brdlist.innerHTML = boardOptions()
    .map(
      (board, index) =>
        `<div class="bitem${index === highlighted ? ' on' : ''}` +
        `${board.id === state.boardId ? ' pick' : ''}" ` +
        `data-b="${board.id === null ? '' : escapeHtml(board.id)}">` +
        `${escapeHtml(board.name)}</div>`
    )
    .join('');
  elements.brdlist.style.display = 'block';
}

export function openPicker() {
  const options = boardOptions();
  if (options.length < 2) return;
  open = true;
  highlighted = Math.max(0, options.findIndex((board) => board.id === state.boardId));
  draw();
}

export function closePicker() {
  if (!open) return;
  open = false;
  elements.brdlist.style.display = 'none';
}

export function movePicker(delta) {
  highlighted = Math.max(0, Math.min(highlighted + delta, boardOptions().length - 1));
  draw();
}

export function choosePicker() {
  const board = boardOptions()[highlighted];
  closePicker();
  if (board) onPick(board.id);
}

function pickFromValue(value) {
  closePicker();
  onPick(value === '' ? null : Number(value));
}

export function installBoardPicker(handler) {
  onPick = handler;

  elements.brdbtn.addEventListener('mousedown', (event) => {
    event.preventDefault();
    if (open) closePicker();
    else openPicker();
  });

  elements.brdlist.addEventListener('mousedown', (event) => {
    const option = event.target.closest('.bitem');
    if (!option) return;
    event.preventDefault();
    pickFromValue(option.dataset.b);
  });
}
