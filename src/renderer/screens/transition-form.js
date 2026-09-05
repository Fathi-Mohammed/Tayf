import { t } from '../i18n.js';
import elements from '../elements.js';
import { showLayout, paintBanners, setVisible, setFooterMeta } from '../chrome.js';
import { escapeHtml } from '../format.js';
import { parseEstimate } from '../dates.js';
import { createGridRows, renderRequiredRows, collectRequiredRows } from '../field-rows.js';
import { transitionContext, needsWorklog, needsRequiredFields, runTransition } from './transitions.js';

const WORKLOG_HINT = t("الوقت ده بيتسجل شغل على التاسك — من غيره جيرا مش هيعدّي الحالة.");
const REQUIRED_HINT = t("التاسك مش بتبدأ من غير دول — هيتحفظوا عليها الأول وبعدين تتنقل.");
const MISSING_WORKLOG = t("اكتب الوقت اللي التاسك خدته — من غيره جيرا هيرفض.");

let rows = null;
let requiredEntries = [];

export function setNote(text, className) {
  elements.fnote.textContent = text || '';
  elements.fnote.className = className || '';
}

export function copyEstimateIntoWorklog() {
  const { item } = transitionContext;
  if (!item || !item.estimate || elements.ftime.style.display === 'none') return;
  elements.ftime.value = item.estimate;
  elements.ftime.focus();
  setNote(t("الوقت اللي هيتسجل: {0}", [item.estimate]), 'good');
}

export function submit() {
  const transition = transitionContext.pending;
  if (!transition || !transitionContext.item) return;

  const transitionFields = {};
  if (transition.resolutions && transition.resolutions.length && elements.fres.value) {
    transitionFields.resolution = { id: elements.fres.value };
  }

  let timeSpent = null;
  if (elements.ftime.style.display !== 'none') {
    const parsed = parseEstimate(elements.ftime.value);
    if (!parsed.ok) {
      setNote(parsed.label, 'bad');
      elements.ftime.focus();
      return;
    }
    if (!parsed.value) {
      setNote(MISSING_WORKLOG, 'bad');
      elements.ftime.focus();
      return;
    }
    timeSpent = parsed.value;
  }

  let fieldsBefore = null;
  if (requiredEntries.length) {
    const collected = collectRequiredRows(requiredEntries);
    if (collected.error) {
      setNote(collected.error, 'bad');
      collected.element.focus();
      return;
    }
    fieldsBefore = collected.fields;
  }

  runTransition(transition, { transitionFields, timeSpent, fieldsBefore });
}

export const transitionFormScreen = {
  name: 'transitionForm',

  enter({ transition }) {
    const { item } = transitionContext;
    transitionContext.pending = transition;

    if (!rows) rows = createGridRows(elements.finishGrid, elements.lblfres);

    elements.ftask.innerHTML =
      `<b>${escapeHtml(item.key)}</b> &nbsp; ${escapeHtml(item.title || '')}` +
      ` &nbsp;<span class="to">&larr; ${escapeHtml(transition.toStatus)}</span>`;

    const resolutions = transition.resolutions || [];
    const wantsResolution = resolutions.length > 0;
    setVisible(elements.lblfres, wantsResolution, '');
    setVisible(elements.fres, wantsResolution, '');
    if (wantsResolution) {
      elements.fres.innerHTML = resolutions
        .map((one) => `<option value="${escapeHtml(one.id)}">${escapeHtml(one.name)}</option>`)
        .join('');
      const done = resolutions.find((one) => /^done$/i.test(one.name));
      if (done) elements.fres.value = done.id;
    }

    const wantsWorklog = needsWorklog(transition);
    setVisible(elements.lblftime, wantsWorklog, '');
    setVisible(elements.ftime, wantsWorklog, '');
    elements.ftime.value = '';

    setVisible(elements.fest, wantsWorklog, 'flex');
    if (wantsWorklog) {
      elements.fest.innerHTML = item.estimate
        ? t("المتوقع كان <b>{0}</b>", [escapeHtml(item.estimate)]) +
          t("<span class=\"chip\" id=\"festfill\"><b>Alt1</b>حطّه زي ما هو</span>")
        : t("مفيش وقت متوقع متسجّل على التاسك");
    }

    const wantsRequired = needsRequiredFields(transition);
    requiredEntries = renderRequiredRows(
      rows,
      wantsRequired ? transitionContext.requiredFields : [],
      setNote
    );

    setNote(wantsRequired ? REQUIRED_HINT : wantsWorklog ? WORKLOG_HINT : '', '');
    this.render();

    const first = requiredEntries.length
      ? requiredEntries[0].element
      : wantsResolution
        ? elements.fres
        : elements.ftime;
    first.focus();
  },

  leave() {
    if (rows) rows.clear();
    requiredEntries = [];
  },

  render() {
    showLayout('transitionForm');
    paintBanners();
    setFooterMeta('metaf', transitionContext.item ? transitionContext.item.key : '');
  }
};

elements.ftime.addEventListener('input', () => {
  if (!elements.ftime.value.trim()) {
    setNote(WORKLOG_HINT, '');
    return;
  }
  const parsed = parseEstimate(elements.ftime.value);
  setNote(parsed.ok ? t("هيتسجل: {0}", [parsed.value]) : parsed.label, parsed.ok ? 'good' : 'bad');
});

elements.fest.addEventListener('click', (event) => {
  if (event.target.closest('#festfill')) copyEstimateIntoWorklog();
});
