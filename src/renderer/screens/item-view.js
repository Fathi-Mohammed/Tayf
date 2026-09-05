import { t } from '../i18n.js';
import elements from '../elements.js';
import { state } from '../state.js';
import { showLayout, paintBanners, setContext, setFooterMeta } from '../chrome.js';
import { escapeHtml } from '../format.js';

const context = { detail: null, requestId: 0 };

export function currentDetail() {
  return context.detail;
}

function metaEntries(item, detail) {
  const entries = [
    ['', detail.key],
    [t("النوع"), detail.type || '-'],
    [t("الحالة"), detail.status || '-'],
    [t("مسندة لـ"), detail.assignee || t("مش مسندة")]
  ];

  if ((item.boards || []).length) {
    entries.push([t("البورد"), item.boards.map((board) => board.name).join(t("، "))]);
  }
  if (detail.due) entries.push([t("التسليم"), detail.due]);
  if (detail.estimate) entries.push([t("الوقت"), detail.estimate]);

  Object.values(detail.optionValues || {}).forEach((option) => entries.push(['', option.value]));
  if ((detail.labels || []).length) entries.push(['labels', detail.labels.join(t("، "))]);

  return entries;
}

export const itemViewScreen = {
  name: 'itemView',

  async enter({ item }) {
    context.detail = null;
    setContext('');

    elements.vtitle.textContent = item.title || '';
    elements.vmeta.innerHTML = '';
    elements.vdesc.textContent = t("بيحمّل…");
    elements.vdesc.className = 'empty';
    setFooterMeta('metav', item.key);

    this.render();
    elements.search.blur();

    const requestId = ++context.requestId;
    const response = await window.tayf.item(item.key);
    if (requestId !== context.requestId) return;

    if (response.error) {
      elements.vdesc.textContent = response.error;
      return;
    }

    const detail = response.item;
    context.detail = detail;
    elements.vtitle.textContent = detail.title;
    elements.vmeta.innerHTML = metaEntries(item, detail)
      .map(
        ([label, value]) =>
          `<span>${label ? `<b>${escapeHtml(label)}</b>` : ''}${escapeHtml(value)}</span>`
      )
      .join('');

    if (detail.description) {
      elements.vdesc.textContent = detail.description;
      elements.vdesc.className = '';
    } else {
      elements.vdesc.textContent = t("مفيش وصف للتاسك دي.");
      elements.vdesc.className = 'empty';
    }
  },

  leave() {
    context.requestId += 1;
    context.detail = null;
  },

  render() {
    showLayout('itemView');
    paintBanners();
    state.rows = [];
  }
};
