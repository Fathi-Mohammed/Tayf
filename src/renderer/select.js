import { t } from './i18n.js';
import { escapeHtml } from './format.js';

// قايمة اختيار: زرار بيفتح لوحة، مع بحث لما الاختيارات تكتر، واختيار مفرد أو متعدد.
//
// اللوحة بتتعلّق على <body> مش جوه الصف، لأن #sbody بيسكرول و #panel عنده
// overflow: hidden — لوحة جوه أي منهم كانت هتتقص. ولوحة واحدة بس بتتشارك بين
// كل القوايم لأن مفيش أكتر من وحدة مفتوحة في نفس الوقت.
//
// النقطة الملوّنة بتتحدد بـ data-dot والألوان في الـ CSS، مش style عنصر —
// الـ CSP بتاعنا (style-src 'self') بيمنع الـ inline styles.

const SEARCH_FROM = 8;
const PANEL_GAP = 4;
const EDGE_GAP = 8;
const PANEL_MAX = 320;   // نفس الـ max-width في الـ CSS — min-width بيغلب max-width

const CHEVRON =
  '<svg class="sel-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

const CHECK =
  '<svg class="sel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

let panel = null;
let active = null;

function buildPanel() {
  if (panel) return panel;

  panel = document.createElement('div');
  panel.className = 'sel-panel';
  panel.hidden = true;
  document.body.appendChild(panel);

  // capture مش bubble: الاختيار بيعيد رسم القايمة، فلما ييجي دور الـ bubble
  // يكون العنصر المدوس عليه اتشال خلاص و panel.contains بيرجع false — وساعتها
  // كنا بنقفل اللوحة وإحنا فاكرين إن الدوسة كانت برّه.
  document.addEventListener(
    'mousedown',
    (event) => {
      if (!active) return;
      if (panel.contains(event.target) || active.holds(event.target)) return;
      active.close();
    },
    true
  );
  window.addEventListener('resize', () => active && active.close());

  return panel;
}

function dotMarkup(dot) {
  return dot ? `<span class="sel-dot" data-dot="${escapeHtml(dot)}"></span>` : '';
}

export function createSelect(hostId, { multiple, searchable, emptyLabel, summary, onChange } = {}) {
  const host = document.getElementById(hostId);
  const empty = emptyLabel || '—';

  let options = [];
  let chosen = multiple ? [] : '';
  let highlighted = 0;
  let query = '';
  let open = false;
  let listBox = null;
  let searchBox = null;

  host.classList.add('sel');
  host.innerHTML =
    '<button class="sel-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">' +
    `<span class="sel-value"></span>${CHEVRON}</button>`;

  const trigger = host.querySelector('.sel-trigger');
  const valueSlot = host.querySelector('.sel-value');

  const isPicked = (id) => (multiple ? chosen.includes(id) : chosen === id);
  const optionFor = (id) => options.find((option) => option.id === id);

  const wantsSearch = () =>
    searchable === true || (searchable !== false && options.length >= SEARCH_FROM);

  function matching() {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }

  function drawTrigger() {
    const picked = multiple
      ? options.filter((option) => chosen.includes(option.id))
      : [optionFor(chosen)].filter(Boolean);

    if (!picked.length) {
      valueSlot.innerHTML = `<span class="sel-text dim">${escapeHtml(empty)}</span>`;
      return;
    }

    const labels = picked.map((option) => option.label);
    const text = summary ? summary(labels) : labels.join(t("، "));
    const dot = picked.length === 1 ? dotMarkup(picked[0].dot) : '';
    valueSlot.innerHTML = `${dot}<span class="sel-text">${escapeHtml(text)}</span>`;
  }

  // اللوحة بتتبني مرة واحدة عند الفتح، والقايمة لوحدها هي اللي بتتعاد.
  // كده خانة البحث ماتتمسحش تحت إيد المستخدم والفوكس يفضل فيها بعد كل اختيار.
  function buildShell() {
    const search = wantsSearch()
      ? t("<div class=\"sel-search\"><input type=\"text\" spellcheck=\"false\" placeholder=\"دوّر…\" /></div>")
      : '';
    panel.innerHTML = `${search}<div class="sel-list" role="listbox"></div>`;
    listBox = panel.querySelector('.sel-list');
    searchBox = panel.querySelector('.sel-search input');
  }

  function drawList() {
    const visible = matching();
    if (highlighted >= visible.length) highlighted = Math.max(0, visible.length - 1);

    listBox.innerHTML = visible.length
      ? visible
          .map((option, index) => {
            const marks =
              (index === highlighted ? ' on' : '') + (isPicked(option.id) ? ' picked' : '');
            return (
              `<div class="sel-opt${marks}" role="option" data-id="${escapeHtml(option.id)}">` +
              `${dotMarkup(option.dot)}<span class="sel-text">${escapeHtml(option.label)}</span>` +
              `${CHECK}</div>`
            );
          })
          .join('')
      : t("<div class=\"sel-empty\">مفيش نتايج</div>");

    const current = listBox.children[highlighted];
    if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
  }

  function place() {
    const rect = trigger.getBoundingClientRect();
    panel.style.minWidth = `${Math.min(rect.width, PANEL_MAX)}px`;
    panel.hidden = false;

    const { offsetHeight: height, offsetWidth: width } = panel;

    let top = rect.bottom + PANEL_GAP;
    if (top + height > window.innerHeight - EDGE_GAP) {
      top = Math.max(EDGE_GAP, rect.top - height - PANEL_GAP);
    }

    let left = document.documentElement.dir === 'ltr' ? rect.left : rect.right - width;
    if (left + width > window.innerWidth - EDGE_GAP) left = window.innerWidth - width - EDGE_GAP;
    if (left < EDGE_GAP) left = EDGE_GAP;

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }

  function openPanel() {
    if (open) return;
    if (active) active.close();

    buildPanel();
    open = true;
    query = '';
    highlighted = Math.max(
      0,
      options.findIndex((option) => isPicked(option.id))
    );

    active = api;
    trigger.setAttribute('aria-expanded', 'true');
    buildShell();
    drawList();
    place();
    if (searchBox) searchBox.focus();
  }

  function closePanel({ refocus } = {}) {
    if (!open) return;
    open = false;
    query = '';
    if (active === api) active = null;
    if (panel) panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) trigger.focus();
  }

  function pick(id) {
    if (multiple) {
      const next = chosen.includes(id)
        ? chosen.filter((value) => value !== id)
        : [...chosen, id];
      const accepted = onChange ? onChange(next, id) : true;
      if (accepted === false) return;
      chosen = next;
      drawTrigger();
      drawList();
      return;
    }

    const changed = id !== chosen;
    chosen = id;
    drawTrigger();
    closePanel({ refocus: true });
    if (changed && onChange) onChange(id);
  }

  function move(delta) {
    const visible = matching();
    if (!visible.length) return;
    highlighted = Math.max(0, Math.min(highlighted + delta, visible.length - 1));
    drawList();
  }

  function onKey(event) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        openPanel();
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || (event.key === ' ' && !searchBox)) {
      // المسافة بتعلّم زي Enter، إلا لما يكون فيه بحث — ساعتها هي مسافة عادية.
      event.preventDefault();
      event.stopPropagation();
      const target = matching()[highlighted];
      if (target) pick(target.id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePanel({ refocus: true });
    } else if (event.key === 'Tab') {
      // الفوكس بيرجع للزرار عشان Tab يكمّل من عنده للكنترول اللي بعده،
      // مش من جوه لوحة اتخفت لسه.
      closePanel({ refocus: true });
    }
  }

  trigger.addEventListener('click', () => (open ? closePanel() : openPanel()));
  trigger.addEventListener('keydown', onKey);

  buildPanel().addEventListener('keydown', (event) => {
    if (active === api) onKey(event);
  });
  panel.addEventListener('input', (event) => {
    if (active !== api || event.target !== searchBox) return;
    query = searchBox.value;
    highlighted = 0;
    drawList();
    place();
  });
  panel.addEventListener('mousedown', (event) => {
    if (active !== api) return;
    const option = event.target.closest('.sel-opt');
    if (!option) return;
    event.preventDefault();
    pick(option.dataset.id);
  });

  const api = {
    holds: (node) => host.contains(node),
    close: () => closePanel(),

    setOptions(nextOptions, value) {
      options = nextOptions || [];
      api.setValue(value);
    },

    get value() {
      return multiple ? [...chosen] : chosen;
    },

    setValue(value) {
      if (multiple) {
        const wanted = Array.isArray(value) ? value : [];
        chosen = options.filter((option) => wanted.includes(option.id)).map((option) => option.id);
      } else {
        chosen = options.some((option) => option.id === value) ? value : '';
      }
      drawTrigger();
      if (open) drawList();
    }
  };

  drawTrigger();
  return api;
}
