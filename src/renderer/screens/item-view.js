import { t } from '../i18n.js';
import elements from '../elements.js';
import { state } from '../state.js';
import { showLayout, paintBanners, setContext, setFooterMeta, setFlash } from '../chrome.js';
import { escapeHtml, relativeTime, UNTITLED } from '../format.js';
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

const context = { detail: null, requestId: 0, sending: false, loadingOlder: false };

export function currentDetail() {
  return context.detail;
}

function imagesOf(detail) {
  const byName = new Map((detail.attachments || []).map((one) => [one.name, one.url]));
  return (block) => byName.get(block.name) || '';
}

// أول حرف من أول كلمتين في الاسم — بديل الصورة الشخصية، وكفاية عشان تفرّق
// بين اللي بيتكلموا وإنت بتقرا سريع.
function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return t("؟");
  return words.slice(0, 2).map((word) => [...word][0]).join('');
}

function isMine(comment) {
  const me = state.workspace.user;
  if (!me) return false;
  if (comment.authorId && me.accountId) return comment.authorId === me.accountId;
  return !!comment.author && comment.author === me.name;
}

function commentNode(comment, resolve) {
  const box = document.createElement('div');
  box.className = isMine(comment) ? 'vcom mine' : 'vcom';

  const face = document.createElement('div');
  face.className = 'vwho';
  face.textContent = initialsOf(comment.author);

  const said = document.createElement('div');
  said.className = 'vsaid';

  const head = document.createElement('div');
  head.className = 'vwhen';
  const who = document.createElement('b');
  who.dir = 'auto';
  who.textContent = comment.author || t("مش معروف");
  const when = document.createElement('i');
  when.textContent = comment.at ? relativeTime(Date.parse(comment.at)) : '';
  head.append(who, when);

  const body = document.createElement('div');
  body.className = 'vbody';
  body.dir = 'auto';
  setImageTools(body, { resolve });
  if (comment.doc) writeDoc(body, comment.doc);
  else body.textContent = comment.text || '';

  said.append(head, body);
  box.append(face, said);
  return box;
}

function countText(shown, total) {
  if (!total) return '';
  return shown < total ? t("{0} من {1}", [shown, total]) : String(total);
}

function moreText(older) {
  if (older === 1) return t("اعرض الكومنت الأقدم");
  if (older === 2) return t("اعرض الكومنتين الأقدم");
  if (older <= 10) return t("اعرض {0} كومنتات أقدم", [older]);
  return t("اعرض {0} كومنت أقدم", [older]);
}

function paintMore(detail) {
  const shown = detail ? (detail.comments || []).length : 0;
  const older = detail ? Math.max(0, (detail.commentTotal || shown) - shown) : 0;

  elements.vmore.style.display = older ? 'block' : 'none';
  elements.vmore.disabled = context.loadingOlder;
  elements.vmore.textContent = context.loadingOlder ? t("بيحمّل…") : moreText(older);
}

// الصور بتوصل بعد ما الكومنتات تترسم وبتزوّد الطول، فبنمسك المسافة من تحت
// ونرجّعها بعد كل صورة تخلص — كده اللي بتقراه ما بيتزقّش من تحت إيدك. أول ما
// تسكرول بنفسك بنسيب التثبيت خالص.
let anchor = null;

function applyAnchor() {
  if (anchor === null) return;
  elements.vscroll.scrollTop = elements.vscroll.scrollHeight - anchor;
}

function holdScroll(fromBottom) {
  anchor = fromBottom;
  applyAnchor();
  elements.vscroll.querySelectorAll('img').forEach((image) => {
    if (!image.complete) image.addEventListener('load', applyAnchor, { once: true });
  });
}

function renderComments(detail, { toNewest = false } = {}) {
  anchor = null;
  elements.vcomments.innerHTML = '';
  elements.vcount.textContent = '';
  paintMore(detail);
  if (!detail) return;

  const comments = detail.comments || [];
  elements.vcount.textContent = countText(comments.length, detail.commentTotal || comments.length);

  if (!comments.length) {
    const line = document.createElement('div');
    line.className = 'vempty';
    line.textContent = t("مفيش كومنتات لسه — ابدأ إنت.");
    elements.vcomments.appendChild(line);
    return;
  }

  const resolve = imagesOf(detail);
  comments.forEach((comment) => elements.vcomments.appendChild(commentNode(comment, resolve)));
  if (toNewest) holdScroll(elements.vscroll.clientHeight);
}

// الأقدم بيتزق فوق القايمة، فبنثبّت على المسافة من تحت — اللي بتقراه يفضل مكانه.
async function loadOlder() {
  const { detail } = context;
  if (!detail || context.loadingOlder) return;

  context.loadingOlder = true;
  paintMore(detail);

  const before = elements.vscroll.scrollHeight - elements.vscroll.scrollTop;
  const response = await window.tayf.olderComments({
    key: detail.key,
    loaded: (detail.comments || []).length
  });

  context.loadingOlder = false;
  if (context.detail !== detail) return;

  if (response.error) {
    setFlash(escapeHtml(response.error), 'bad');
    paintMore(detail);
    return;
  }

  const known = new Set((detail.comments || []).map((one) => one.id));
  const older = (response.comments || []).filter((one) => !known.has(one.id));
  detail.comments = [...older, ...(detail.comments || [])];
  if (response.commentTotal) detail.commentTotal = response.commentTotal;
  if (!older.length) detail.commentTotal = detail.comments.length;

  renderComments(detail);
  holdScroll(before);
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
  renderComments(detail, { toNewest: true });
  setFlash(`اتبعت كومنت · <b>${escapeHtml(detail.key)}</b>`, 'done');
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
    context.loadingOlder = false;
    setContext('');

    elements.vtitle.textContent = item.title || UNTITLED;
    elements.vmeta.innerHTML = '';
    elements.vdesc.textContent = t("بيحمّل…");
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
    elements.vtitle.textContent = detail.title || UNTITLED;
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

    renderComments(detail, { toNewest: true });
    renderPeople(detail);
  },

  leave() {
    context.requestId += 1;
    context.detail = null;
    context.loadingOlder = false;
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
elements.vmore.addEventListener('click', loadOlder);
elements.vscroll.addEventListener('wheel', () => {
  anchor = null;
});
