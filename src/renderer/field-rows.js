import { t } from './i18n.js';
import { escapeHtml } from './format.js';
import { parseDueDate, parseEstimate } from './dates.js';

const DATE_PLACEHOLDER = t("النهاردة · بكرة · +3 · 2026-09-05");
const ESTIMATE_PLACEHOLDER = t("اكتب رقم بالدقايق أو 4h · 2d");

export function createGridRows(grid, anchor) {
  let nodes = [];

  return {
    clear() {
      nodes.forEach((node) => node.remove());
      nodes = [];
    },
    add(label, control) {
      grid.insertBefore(label, anchor);
      grid.insertBefore(control, anchor);
      nodes.push(label, control);
    }
  };
}

function labelFor(id, text) {
  const label = document.createElement('label');
  label.textContent = text;
  label.setAttribute('for', id);
  return label;
}

export function renderOptionRows(rows, optionFields, { boardFields, remembered }) {
  rows.clear();
  const entries = [];

  (optionFields || []).forEach((field) => {
    const id = `option_${field.id}`;
    const select = document.createElement('select');
    select.id = id;
    select.innerHTML =
      '<option value="">—</option>' +
      field.values
        .map((value) => `<option value="${escapeHtml(value.id)}">${escapeHtml(value.value)}</option>`)
        .join('');

    const wanted = boardFields && boardFields[field.id];
    const wantedValue = wanted && (wanted.value || wanted);
    const matchedByValue = wantedValue
      ? field.values.find((value) => value.value === wantedValue)
      : null;
    const rememberedId = remembered && remembered[field.id] && remembered[field.id].id;

    if (matchedByValue) select.value = matchedByValue.id;
    else if (rememberedId) select.value = rememberedId;

    rows.add(labelFor(id, field.name), select);
    entries.push({ field, element: select });
  });

  return entries;
}

export function collectOptionRows(entries) {
  const fields = {};
  entries.forEach(({ field, element }) => {
    if (element.value) fields[field.id] = { id: element.value };
  });
  return fields;
}

export function renderDateRows(rows, dateFields, { values, defaultToToday, onFeedback }) {
  rows.clear();
  const entries = [];

  (dateFields || []).forEach((field) => {
    const id = `date_${field.id}`;
    const input = document.createElement('input');
    input.id = id;
    input.spellcheck = false;
    input.placeholder = DATE_PLACEHOLDER;

    if (values && values[field.id]) input.value = values[field.id];
    else if (field.isStartDate && defaultToToday) input.value = defaultToToday;

    input.addEventListener('input', () => {
      if (!input.value.trim()) {
        onFeedback('', '');
        return;
      }
      const parsed = parseDueDate(input.value);
      onFeedback(parsed.ok ? `${field.name}: ${parsed.label}` : parsed.label, parsed.ok ? 'good' : 'bad');
    });

    rows.add(labelFor(id, field.name), input);
    entries.push({ field, element: input });
  });

  return entries;
}

export function collectDateRows(entries) {
  const fields = {};
  for (const { field, element } of entries) {
    const text = element.value.trim();
    if (!text) {
      fields[field.id] = null;
      continue;
    }
    const parsed = parseDueDate(text);
    if (!parsed.ok) return { error: `${field.name}: ${parsed.label}`, element };
    fields[field.id] = parsed.value;
  }
  return { fields };
}

export function renderRequiredRows(rows, requiredFields, onFeedback) {
  rows.clear();
  const entries = [];

  (requiredFields || []).forEach((field) => {
    const id = `required_${field.id}`;
    const input = document.createElement('input');
    input.id = id;
    input.spellcheck = false;
    input.placeholder = field.kind === 'estimate' ? ESTIMATE_PLACEHOLDER : DATE_PLACEHOLDER;
    if (field.defaultValue) input.value = field.defaultValue;

    input.addEventListener('input', () => {
      const text = input.value.trim();
      if (!text) {
        onFeedback('', '');
        return;
      }
      const parsed = field.kind === 'estimate' ? parseEstimate(text) : parseDueDate(text);
      onFeedback(
        parsed.ok ? `${field.name}: ${parsed.label || parsed.value}` : parsed.label,
        parsed.ok ? 'good' : 'bad'
      );
    });

    rows.add(labelFor(id, field.name), input);
    entries.push({ field, element: input });
  });

  return entries;
}

export function collectRequiredRows(entries) {
  const missing = t(" لازم يتملا قبل ما التاسك تبدأ");
  const fields = {};

  for (const { field, element } of entries) {
    const text = element.value.trim();
    if (!text) return { error: field.name + missing, element };

    const parsed = field.kind === 'estimate' ? parseEstimate(text) : parseDueDate(text);
    if (!parsed.ok) return { error: `${field.name}: ${parsed.label}`, element };
    if (!parsed.value) return { error: field.name + missing, element };

    if (field.kind === 'estimate') fields.timetracking = { originalEstimate: parsed.value };
    else fields[field.id] = parsed.value;
  }

  return { fields };
}
