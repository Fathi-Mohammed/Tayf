import elements from '../elements.js';
import { state } from '../state.js';
import { showLayout, paintBanners, setContext, setFooterMeta, setFlash } from '../chrome.js';
import { escapeHtml, relativeTime } from '../format.js';
import {
  installEditor,
  readDoc,
  writeDoc,
  clearEditor,
  isEmpty,
  focusEditor,
  setImageTools
} from '../editor.js';
import {
  resetMentions,
  attachMentions,
  insertMention,
  peopleFor
} from '../mention-picker.js';

const context = { detail: null, requestId: 0, sending: false };

export function currentDetail() {
  return context.detail;
}

function imagesOf(detail) {
  const byName = new Map((detail.attachments || []).map((one) => [one.name, one.url]));
  return (block) => byName.get(block.name) || '';
}

function commentNode(comment, resolve) {
  const when = comment.at ? relativeTime(Date.parse(comment.at)) : '';
  const box = document.createElement('div');
  box.className = 'vcom';

  const head = document.createElement('b');
  head.textContent = [comment.author, when].filter(Boolean).join('  ·  ');

  const body = document.createElement('div');
  body.className = 'vbody';
  body.dir = 'auto';
  setImageTools(body, { resolve });
  if (comment.doc) writeDoc(body, comment.doc);
  else body.textContent = comment.text || '';

  box.append(head, body);
  return box;
}

function captionOf(detail, shown) {
  const older = (detail.commentTotal || shown) - shown;
  if (!shown) return 'مفيش كومنتات لسه';
  return older > 0 ? `فيه ${older} كومنت أقدم في جيرا` : '';
}

function renderComments(detail) {
  elements.vcomments.innerHTML = '';
  if (!detail) return;

  const comments = detail.comments || [];
  const caption = captionOf(detail, comments.length);

  if (caption) {
    const line = document.createElement('div');
    line.className = 'vcold';
    line.textContent = caption;
    elements.vcomments.appendChild(line);
  }

  const resolve = imagesOf(detail);
  comments.forEach((comment) => elements.vcomments.appendChild(commentNode(comment, resolve)));
}

const PEOPLE_SHOWN = 4;

async function renderPeople(detail) {
  elements.vpeople.innerHTML = '';
  const users = await peopleFor(detail.projectKey);
  if (context.detail !== detail) return;

  users.slice(0, PEOPLE_SHOWN).forEach((user) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dir = 'auto';
    button.textContent = `+ ${user.name}`;
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      insertMention(elements.vcin, user);
    });
    elements.vpeople.appendChild(button);
  });
}

export function focusComment() {
  focusEditor(elements.vcin);
}

export async function sendComment() {
  const { detail } = context;
  if (!detail || context.sending || isEmpty(elements.vcin)) return;

  const doc = readDoc(elements.vcin);
  if (!doc.blocks.length) return;

  context.sending = true;
  setFlash('بيبعت الكومنت…', 'pending');
  const response = await window.tayf.comment({ key: detail.key, doc });
  context.sending = false;
  if (context.detail !== detail) return;

  if (response.error) {
    setFlash('', '');
    return;
  }

  clearEditor(elements.vcin);
  resetMentions(detail.projectKey);
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
    clearEditor(elements.vcin);
    renderComments(null);
    elements.vpeople.innerHTML = '';
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
    resetMentions(detail.projectKey);
    setImageTools(elements.vcin, {
      resolve: imagesOf(detail),
      upload: async (file) => {
        setFlash('بيرفع الصورة…', 'pending');
        const response = await window.tayf.attach({ key: detail.key, file });
        setFlash('', '');
        return response.error ? null : response.file;
      }
    });
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
    renderPeople(detail);
  },

  leave() {
    context.requestId += 1;
    context.detail = null;
    resetMentions(null);
    clearEditor(elements.vcin);
    renderComments(null);
  },

  render() {
    showLayout('itemView');
    paintBanners();
    state.rows = [];
  }
};

installEditor(elements.vcin);
attachMentions(elements.vcin);
