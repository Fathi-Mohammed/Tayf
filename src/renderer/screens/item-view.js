import elements from '../elements.js';
import { state } from '../state.js';
import { showLayout, paintBanners, setContext, setFooterMeta, setFlash } from '../chrome.js';
import { escapeHtml, relativeTime } from '../format.js';

const context = { detail: null, requestId: 0, sending: false };

export function currentDetail() {
  return context.detail;
}

function commentHtml(comment) {
  const when = comment.at ? relativeTime(Date.parse(comment.at)) : '';
  const line = [comment.author, when].filter(Boolean).join('  ·  ');
  return `<div class="vcom"><b>${escapeHtml(line)}</b><span>${escapeHtml(comment.text)}</span></div>`;
}

function renderComments(detail) {
  if (!detail) {
    elements.vcomments.innerHTML = '';
    return;
  }

  const comments = detail.comments || [];
  const older = (detail.commentTotal || comments.length) - comments.length;

  const caption = comments.length
    ? older > 0
      ? `فيه ${older} كومنت أقدم في جيرا`
      : ''
    : 'مفيش كومنتات لسه';

  elements.vcomments.innerHTML =
    (caption ? `<div class="vcold">${escapeHtml(caption)}</div>` : '') +
    comments.map(commentHtml).join('');
}

export function focusComment() {
  elements.vcin.focus();
}

export async function sendComment() {
  const { detail } = context;
  const text = elements.vcin.value.trim();
  if (!detail || !text || context.sending) return;

  context.sending = true;
  setFlash('بيبعت الكومنت…', 'pending');
  const response = await window.tayf.comment({ key: detail.key, text });
  context.sending = false;
  if (context.detail !== detail) return;

  if (response.error) {
    setFlash('', '');
    return;
  }

  elements.vcin.value = '';
  detail.comments = [...(detail.comments || []), response.comment];
  detail.commentTotal = (detail.commentTotal || 0) + 1;
  renderComments(detail);
  setFlash(`اتبعت كومنت · <b>${escapeHtml(detail.key)}</b>`, 'done');
}

function metaEntries(item, detail) {
  const entries = [
    ['', detail.key],
    ['النوع', detail.type || '-'],
    ['الحالة', detail.status || '-'],
    ['مسندة لـ', detail.assignee || 'مش مسندة']
  ];

  if ((item.boards || []).length) {
    entries.push(['البورد', item.boards.map((board) => board.name).join('، ')]);
  }
  if (detail.due) entries.push(['التسليم', detail.due]);
  if (detail.estimate) entries.push(['الوقت', detail.estimate]);

  Object.values(detail.optionValues || {}).forEach((option) => entries.push(['', option.value]));
  if ((detail.labels || []).length) entries.push(['labels', detail.labels.join('، ')]);

  return entries;
}

export const itemViewScreen = {
  name: 'itemView',

  async enter({ item }) {
    context.detail = null;
    setContext('');

    elements.vtitle.textContent = item.title || '';
    elements.vmeta.innerHTML = '';
    elements.vdesc.textContent = 'بيحمّل…';
    elements.vdesc.className = 'empty';
    elements.vcin.value = '';
    renderComments(null);
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
      elements.vdesc.textContent = 'مفيش وصف للتاسك دي.';
      elements.vdesc.className = 'empty';
    }

    renderComments(detail);
  },

  leave() {
    context.requestId += 1;
    context.detail = null;
    elements.vcin.value = '';
    renderComments(null);
  },

  render() {
    showLayout('itemView');
    paintBanners();
    state.rows = [];
  }
};
