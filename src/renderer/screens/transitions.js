import { t } from '../i18n.js';
import elements from '../elements.js';
import { state } from '../state.js';
import { goTo } from '../navigation.js';
import { showLayout, setContext, paintBanners, setFlash, setFooterMeta, itemCountMeta } from '../chrome.js';
import { paintRows, transitionRowHtml } from '../list-view.js';
import { escapeHtml } from '../format.js';
import { toIsoDate } from '../dates.js';
import { backToTaskList } from './task-list.js';

export const transitionContext = {
  item: null,
  transitions: [],
  requiredFields: null,
  requiredFieldsRequest: null,
  loading: false,
  pending: null
};

export function needsWorklog(transition) {
  const { item } = transitionContext;
  if (!item || item.spentSeconds) return false;

  const tag = `${String(item.key).split('-')[0]}:${transition.id}`;
  if ((state.workspace.transitionsNeedingWorklog || []).includes(tag)) return true;

  return item.category === 'indeterminate' && transition.toCategory !== 'new';
}

export function needsRequiredFields(transition) {
  const { requiredFields } = transitionContext;
  return !!(
    requiredFields &&
    requiredFields.length &&
    transition &&
    transition.toCategory === 'indeterminate'
  );
}

export function needsForm(transition) {
  if (!transition || !transitionContext.item) return false;
  return (
    needsWorklog(transition) ||
    needsRequiredFields(transition) ||
    !!(transition.resolutions && transition.resolutions.length)
  );
}

async function loadRequiredFields(item) {
  const response = await window.tayf.item(item.key);
  if (!response || response.error || !response.item) return null;

  const detail = response.item;
  const meta = await window.tayf.createFields({
    projectKey: detail.projectKey,
    typeId: detail.typeId
  });
  if (!meta || meta.error) return null;

  const alreadySet = detail.dateValues || {};
  const dateFields = meta.dateFields || [];
  const fields = [];

  dateFields
    .filter((field) => field.isStartDate && !alreadySet[field.id])
    .forEach((field) =>
      fields.push({ id: field.id, name: field.name, kind: 'date', defaultValue: toIsoDate(new Date()) })
    );

  if (meta.hasDueDate !== false && !detail.due) {
    fields.push({ id: 'duedate', name: t("التسليم"), kind: 'date' });
  }

  dateFields
    .filter((field) => field.isDueDate && !field.isStartDate && !alreadySet[field.id])
    .forEach((field) => fields.push({ id: field.id, name: field.name, kind: 'date' }));

  if (meta.hasEstimate !== false && !detail.estimate) {
    fields.push({ id: 'estimate', name: t("الوقت المتوقع"), kind: 'estimate' });
  }

  return fields;
}

export async function chooseTransition(transition) {
  const { item, requiredFieldsRequest, requiredFields } = transitionContext;
  if (!transition || !item || state.busy) return;

  if (transition.toCategory === 'indeterminate' && requiredFieldsRequest && !requiredFields) {
    setFlash(t("بيشوف الناقص على <b>{0}</b>…", [escapeHtml(item.key)]), 'pending');
    await requiredFieldsRequest;
    if (transitionContext.item !== item) return;
    setFlash('', '');
  }

  if (needsForm(transition)) {
    transitionContext.pending = transition;
    await goTo('transitionForm', { transition });
    return;
  }

  runTransition(transition, {});
}

export async function runTransition(transition, extras) {
  const { item } = transitionContext;
  if (!item || state.busy) return;

  const key = item.key;
  state.busy = true;
  item.status = transition.toStatus;
  item.category = transition.toCategory;
  transitionContext.pending = null;

  await backToTaskList(key);
  setFlash(t("<b>{0}</b> بينقل لـ {1}…", [escapeHtml(key), escapeHtml(transition.toStatus)]), 'pending');

  const result = await window.tayf.applyTransition({
    key,
    transitionId: transition.id,
    toStatus: transition.toStatus,
    toCategory: transition.toCategory,
    transitionFields: extras.transitionFields || null,
    timeSpent: extras.timeSpent || null,
    fieldsBefore: extras.fieldsBefore || null
  });
  state.busy = false;

  if (!result || result.error) {
    setFlash('', '');
    return;
  }
  setFlash(t("تمّت · <b>{0}</b> بقت {1}", [escapeHtml(key), escapeHtml(transition.toStatus)]), 'done');
}

export const transitionsScreen = {
  name: 'transitions',

  async enter({ item }) {
    transitionContext.item = item;
    transitionContext.transitions = [];
    transitionContext.requiredFields = null;
    transitionContext.loading = true;

    setContext(`<b>${escapeHtml(item.key)}</b> &nbsp; ${escapeHtml(item.title || '')}`);
    elements.search.value = '';
    elements.search.placeholder = t("اختار الحالة الجديدة");
    this.render();

    transitionContext.requiredFieldsRequest = loadRequiredFields(item)
      .catch(() => null)
      .then((fields) => {
        if (transitionContext.item !== item) return fields;
        transitionContext.requiredFields = fields;
        if (!transitionContext.loading) this.render();
        return fields;
      });

    const response = await window.tayf.transitions(item.key);
    if (transitionContext.item !== item) return;

    if (response.error) {
      state.workspace.error = response.error;
      await backToTaskList(item.key);
      return;
    }

    transitionContext.transitions = response.transitions || [];
    transitionContext.loading = false;
    state.selectedIndex = 0;
    this.render();
  },

  leave() {
    transitionContext.pending = null;
  },

  render() {
    showLayout('transitions');
    paintBanners();
    setFooterMeta('meta', itemCountMeta());

    if (transitionContext.loading) {
      elements.list.style.display = 'none';
      elements.msg.style.display = 'block';
      elements.msg.innerHTML = t("<span class=\"dim\">بيجيب الحالات المتاحة…</span>");
      state.rows = [];
      return;
    }

    const query = elements.search.value.trim().toLowerCase();
    const rows = query
      ? transitionContext.transitions.filter((transition) =>
          `${transition.name || ''} ${transition.toStatus || ''}`.toLowerCase().includes(query)
        )
      : transitionContext.transitions;

    paintRows(rows, t("مفيش حالات متاحة للتاسك ده."), (transition, index, selected) =>
      transitionRowHtml(
        transition,
        index,
        selected,
        transition.requiresFields || needsRequiredFields(transition)
      )
    );
  }
};
