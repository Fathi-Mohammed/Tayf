import { t } from '../i18n.js';
import elements from '../elements.js';
import { state } from '../state.js';
import { showLayout, setContext, paintBanners, setFlash, setVisible, setFooterMeta } from '../chrome.js';
import { escapeHtml } from '../format.js';
import { parseDueDate, parseEstimate, toIsoDate, QUICK_DATES, DATE_WORDS } from '../dates.js';
import { createCombo } from '../combo.js';
import {
  createGridRows,
  renderOptionRows,
  collectOptionRows,
  renderDateRows,
  collectDateRows
} from '../field-rows.js';
import { backToTaskList } from './task-list.js';

const context = {
  intent: 'create',
  boards: [],
  requirements: null,
  projectKey: null,
  detail: null,
  submitting: false,
  requestId: 0
};

let optionRows = null;
let dateRows = null;
let optionEntries = [];
let dateEntries = [];

const boardCombo = createCombo('cboard', 'cboardlist', () => onBoardChange());
const assigneeCombo = createCombo('cassignee', 'cassigneelist', null);

export function setNote(text, className) {
  elements.cnote.textContent = text || '';
  elements.cnote.className = className || '';
}

function setRow(control, label, visible) {
  setVisible(control, visible, '');
  setVisible(label, visible, '');
  if (!visible) control.value = '';
}

function ensureRows() {
  if (!optionRows) optionRows = createGridRows(elements.composeGrid, elements.lbldue);
  if (!dateRows) dateRows = createGridRows(elements.composeGrid, elements.lbldue);
}

function showRequirements() {
  const { requirements, projectKey } = context;
  if (!requirements) return;

  const applied = (requirements.applied || []).map((one) => `${one.label} = ${one.value}`);
  if (applied.length) {
    setNote(t("هيتحط تلقائي عشان تظهر على البورد:  {0}", [applied.join('  ·  ')]), 'good');
  } else {
    setNote(t("ده البورد الافتراضي للمشروع — مفيش حاجة زيادة"), '');
  }
  setFooterMeta('metac', projectKey || '');
}

async function loadBoards() {
  setNote(t("بيجيب البوردات…"), '');
  const response = await window.tayf.boards();
  if (response.error) {
    setNote(response.error, 'bad');
    return;
  }

  context.boards = response.boards || [];
  boardCombo.setOptions(
    context.boards.map((board) => ({
      id: String(board.id),
      label: board.name + (board.projectKey ? `  ·  ${board.projectKey}` : '')
    })),
    response.lastBoardId != null ? String(response.lastBoardId) : null
  );
  await onBoardChange();
}

async function onBoardChange() {
  const requestId = ++context.requestId;
  const boardId = parseInt(boardCombo.value, 10);
  const board = context.boards.find((candidate) => candidate.id === boardId);
  if (!board) return;

  setNote(t("بيقرا إعدادات البورد…"), '');
  const requirements = await window.tayf.boardRequirements(boardId);
  if (requestId !== context.requestId) return;

  context.requirements = requirements;
  context.projectKey = (requirements && requirements.projectKey) || board.projectKey;
  if (!context.projectKey) {
    setNote(t("مقدرناش نعرف مشروع البورد ده"), 'bad');
    return;
  }

  await loadIssueTypes(requestId);
  if (requestId !== context.requestId) return;
  showRequirements();
}

async function loadIssueTypes(requestId) {
  elements.ctype.innerHTML = '<option value="">…</option>';
  const response = await window.tayf.issueTypes(context.projectKey);
  if (requestId !== context.requestId) return;

  if (response.error) {
    setNote(response.error, 'bad');
    return;
  }

  const types = response.types || [];
  if (!types.length) {
    setNote(t("مفيش أنواع تاسكات في {0}", [context.projectKey]), 'bad');
    return;
  }

  elements.ctype.innerHTML = types
    .map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`)
    .join('');
  if (response.lastIssueTypeId && types.some((type) => type.id === response.lastIssueTypeId)) {
    elements.ctype.value = response.lastIssueTypeId;
  }

  await loadAssignees(requestId);
  if (requestId !== context.requestId) return;
  await loadCreateFields(requestId);
}

async function loadAssignees(requestId) {
  const response = await window.tayf.assignableUsers(context.projectKey);
  if (requestId !== context.requestId) return;

  if (response.error) {
    assigneeCombo.setOptions([{ id: '', label: '—' }], '');
    return;
  }

  const options = [{ id: '', label: t("— مش مسندة —") }].concat(
    (response.users || []).map((user) => ({ id: user.accountId, label: user.name }))
  );
  assigneeCombo.setOptions(options, response.currentUserId || '');
}

async function loadCreateFields(passedRequestId) {
  const requestId = passedRequestId === undefined ? ++context.requestId : passedRequestId;
  const fields = await window.tayf.createFields({
    projectKey: context.projectKey,
    typeId: elements.ctype.value
  });
  if (requestId !== context.requestId) return;

  ensureRows();
  optionEntries = renderOptionRows(optionRows, fields.optionFields, {
    boardFields: context.requirements && context.requirements.fields,
    remembered: fields.lastOptionFields
  });
  dateEntries = renderDateRows(dateRows, fields.dateFields, {
    values: null,
    defaultToToday: toIsoDate(new Date()),
    onFeedback: setNote
  });

  setRow(elements.cassigneewrap, elements.lblassignee, fields.hasAssignee !== false);
  setRow(elements.duewrap, elements.lbldue, fields.hasDueDate !== false);
  setRow(elements.cest, elements.lblest, fields.hasEstimate !== false);
}

async function submitCreate() {
  if (context.submitting) return;

  const summary = elements.search.value.trim();
  if (!summary) {
    setNote(t("اكتب عنوان التاسك الأول"), 'bad');
    elements.search.focus();
    return;
  }
  if (!boardCombo.value || !elements.ctype.value) {
    setNote(t("مستني البوردات تحمّل"), 'bad');
    return;
  }

  const due = parseDueDate(elements.cdue.value);
  if (!due.ok) {
    setNote(due.label, 'bad');
    elements.cdue.focus();
    return;
  }

  const estimate = parseEstimate(elements.cest.value);
  if (!estimate.ok) {
    setNote(estimate.label, 'bad');
    elements.cest.focus();
    return;
  }

  const dates = collectDateRows(dateEntries);
  if (dates.error) {
    setNote(dates.error, 'bad');
    dates.element.focus();
    return;
  }

  context.submitting = true;
  setNote(t("بيعمل التاسك…"), '');

  const response = await window.tayf.createItem({
    boardId: parseInt(boardCombo.value, 10),
    projectKey: context.projectKey,
    typeId: elements.ctype.value,
    assigneeId: assigneeCombo.value || null,
    summary,
    due: due.value,
    estimate: estimate.value,
    description: elements.cdescin.value,
    dateFields: dates.fields,
    optionFields: collectOptionRows(optionEntries)
  });
  context.submitting = false;

  if (response.error) {
    setNote(response.error, 'bad');
    return;
  }

  await backToTaskList();
  setFlash(t("اتعملت · <b>{0}</b>", [escapeHtml(response.key)]), 'done');
}

async function submitEdit() {
  const { detail } = context;
  if (!detail || context.submitting) return;

  const title = elements.search.value.trim();
  if (!title) {
    setNote(t("العنوان مايبقاش فاضي"), 'bad');
    elements.search.focus();
    return;
  }

  const due = parseDueDate(elements.cdue.value);
  if (!due.ok) {
    setNote(due.label, 'bad');
    elements.cdue.focus();
    return;
  }

  const estimate = parseEstimate(elements.cest.value);
  if (!estimate.ok) {
    setNote(estimate.label, 'bad');
    elements.cest.focus();
    return;
  }

  const dates = collectDateRows(dateEntries);
  if (dates.error) {
    setNote(dates.error, 'bad');
    dates.element.focus();
    return;
  }

  const fields = {};
  if (title !== detail.title) fields.summary = title;

  const assigneeId = assigneeCombo.value || null;
  if (assigneeId !== (detail.assigneeId || null)) {
    fields.assignee = assigneeId ? { accountId: assigneeId } : null;
  }

  if ((due.value || null) !== (detail.due || null)) fields.duedate = due.value;
  if ((estimate.value || null) !== (detail.estimate || null)) {
    fields.timetracking = { originalEstimate: estimate.value || '0m' };
  }

  Object.keys(dates.fields).forEach((fieldId) => {
    const before = (detail.dateValues && detail.dateValues[fieldId]) || null;
    if ((dates.fields[fieldId] || null) !== before) fields[fieldId] = dates.fields[fieldId];
  });

  if (elements.cdescin.value.trim() !== String(detail.description || '').trim()) {
    fields.description = elements.cdescin.value;
  }

  const options = collectOptionRows(optionEntries);
  Object.keys(options).forEach((fieldId) => {
    const before =
      detail.optionValues && detail.optionValues[fieldId] && detail.optionValues[fieldId].id;
    if (options[fieldId].id !== before) fields[fieldId] = options[fieldId];
  });

  if (!Object.keys(fields).length) {
    setNote(t("مفيش حاجة اتغيّرت"), '');
    return;
  }

  context.submitting = true;
  setNote(t("بيحفظ…"), '');
  const response = await window.tayf.updateItem({ key: detail.key, fields });
  context.submitting = false;

  if (response.error) {
    setNote(response.error, 'bad');
    return;
  }

  const key = detail.key;
  await backToTaskList(key);
  setFlash(t("اتحفظت · <b>{0}</b>", [escapeHtml(key)]), 'done');
}

export function submit() {
  return context.intent === 'edit' ? submitEdit() : submitCreate();
}

export function currentDetail() {
  return context.detail;
}

export function isEditing() {
  return context.intent === 'edit';
}

export function setDueDate(text) {
  elements.cdue.value = text;
  elements.cdue.dispatchEvent(new Event('input'));
  elements.cdue.focus();
}

async function enterCreate(prefillTitle) {
  context.intent = 'create';
  context.detail = null;
  ensureRows();

  setContext('');
  setVisible(elements.cdesc, false);
  setRow(elements.cboardwrap, elements.lblboard, true);
  setRow(elements.ctype, elements.lbltype, true);
  elements.cdescin.value = '';
  elements.search.placeholder = t("عنوان التاسك الجديدة");
  if (prefillTitle !== undefined) elements.search.value = prefillTitle;

  composeScreen.render();
  elements.search.focus();
  elements.search.select();

  if (!context.boards.length) await loadBoards();
  else if (!context.requirements) await onBoardChange();
  else showRequirements();
}

async function enterEdit(item) {
  context.intent = 'edit';
  context.detail = null;
  context.requirements = null;
  ensureRows();

  elements.search.placeholder = t("عنوان التاسك");
  elements.search.value = item.title || '';
  setContext(
    `<b>${escapeHtml(item.key)}</b> &nbsp; ${escapeHtml(item.type || '')}` +
      ` &nbsp;·&nbsp; ${escapeHtml(item.status || '')}`
  );
  setVisible(elements.cdesc, false);
  composeScreen.render();
  setNote(t("بيجيب التفاصيل…"), '');

  const requestId = ++context.requestId;
  const response = await window.tayf.item(item.key);
  if (requestId !== context.requestId) return;
  if (response.error) {
    setNote(response.error, 'bad');
    return;
  }

  const detail = response.item;
  context.detail = detail;
  elements.search.value = detail.title;
  setFooterMeta('metad', detail.key);

  setRow(elements.cboardwrap, elements.lblboard, false);
  setRow(elements.ctype, elements.lbltype, false);

  context.projectKey = detail.projectKey;
  await loadAssignees(requestId);
  if (requestId !== context.requestId) return;
  assigneeCombo.setValue(detail.assigneeId || '');

  const fields = await window.tayf.createFields({
    projectKey: context.projectKey,
    typeId: detail.typeId
  });
  if (requestId !== context.requestId) return;

  optionEntries = renderOptionRows(optionRows, fields.optionFields, {
    boardFields: null,
    remembered: detail.optionValues
  });
  dateEntries = renderDateRows(dateRows, fields.dateFields, {
    values: detail.dateValues || {},
    defaultToToday: null,
    onFeedback: setNote
  });

  setRow(elements.duewrap, elements.lbldue, fields.hasDueDate !== false);
  setRow(elements.cest, elements.lblest, fields.hasEstimate !== false);

  elements.cdue.value = detail.due || '';
  elements.cest.value = detail.estimate || '';
  elements.cdescin.value = detail.description || '';

  setNote('', '');
  elements.search.focus();
  elements.search.select();
}

export const composeScreen = {
  name: 'compose',

  enter({ intent, item, prefillTitle }) {
    return intent === 'edit' ? enterEdit(item) : enterCreate(prefillTitle);
  },

  leave() {
    context.requestId += 1;
    if (optionRows) optionRows.clear();
    if (dateRows) dateRows.clear();
    optionEntries = [];
    dateEntries = [];
    elements.cdescin.value = '';
    context.detail = null;
  },

  render() {
    showLayout(context.intent === 'edit' ? 'edit' : 'compose');
    paintBanners();
    state.rows = [];
  }
};

elements.ctype.addEventListener('change', () => loadCreateFields());

elements.cdue.addEventListener('input', () => {
  if (!elements.cdue.value.trim()) {
    showRequirements();
    return;
  }
  const parsed = parseDueDate(elements.cdue.value);
  setNote(parsed.ok ? t("التسليم: {0}", [parsed.label]) : parsed.label, parsed.ok ? 'good' : 'bad');
});

elements.cest.addEventListener('input', () => {
  if (!elements.cest.value.trim()) {
    showRequirements();
    return;
  }
  const parsed = parseEstimate(elements.cest.value);
  setNote(parsed.ok ? t("الوقت المتوقع: {0}", [parsed.value]) : parsed.label, parsed.ok ? 'good' : 'bad');
});

elements.cdue.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || event.shiftKey) return;
  const typed = elements.cdue.value.trim().toLowerCase();
  if (!typed) return;
  const completion = DATE_WORDS.find((word) =>
    word.toLowerCase() !== typed && word.toLowerCase().startsWith(typed)
  );
  if (!completion) return;
  event.preventDefault();
  setDueDate(completion);
});

elements.chips.innerHTML = QUICK_DATES.map(
  (quick) =>
    `<span class="chip" data-v="${escapeHtml(quick.label)}">` +
    `<b>Alt${quick.key}</b>${escapeHtml(quick.label)}</span>`
).join('');

elements.chips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (chip) setDueDate(chip.dataset.v);
});
