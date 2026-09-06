import elements from '../elements.js';
import { state } from '../state.js';
import { showLayout, paintBanners, setFooterMeta } from '../chrome.js';
import { createSelect } from '../select.js';
import { toIsoDate } from '../dates.js';
import { escapeHtml, shortDuration } from '../format.js';

const ALL_PROJECTS = 'all';
const SPANS = [1, 7, 14, 30];
const PODIUM = 3;
const CUSTOM = 0;

// The podium reads 2 · 1 · 3 like every podium; under dir="rtl" that DOM order
// puts second on the right and third on the left, mirroring the usual picture.
const PODIUM_ORDER = [1, 0, 2];

const context = {
  scope: ALL_PROJECTS,
  days: 14,
  from: null,
  to: null,
  person: '',
  board: null,
  requestId: 0,
  loading: false
};

let scopeSelect = null;
let personSelect = null;

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return toIsoDate(date);
}

function activeRange() {
  if (context.days === CUSTOM) return { from: context.from, to: context.to };
  return { from: isoDaysAgo(context.days), to: toIsoDate(new Date()) };
}

function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '؟';
  return words.slice(0, 2).map((word) => [...word][0]).join('');
}

function isMe(person) {
  const me = state.workspace.user;
  if (!me || !person) return false;
  if (person.id && me.accountId) return person.id === me.accountId;
  return !!person.name && person.name === me.name;
}

function hoursText(seconds) {
  return shortDuration(seconds);
}

function faceHtml(person, rank) {
  return (
    `<span class="rface r${rank}">${escapeHtml(initialsOf(person.name))}` +
    `<b class="rmedal">${rank}</b></span>`
  );
}

function podiumHtml(people) {
  const top = PODIUM_ORDER.filter((index) => people[index]);

  return top
    .map((index) => {
      const person = people[index];
      const rank = index + 1;
      const mine = isMe(person) ? ' mine' : '';

      return (
        `<div class="rstep s${rank}${mine}">` +
        (rank === 1 ? '<span class="rcrown">♕</span>' : '') +
        faceHtml(person, rank) +
        `<span class="rwho" dir="auto">${escapeHtml(person.name)}</span>` +
        `<span class="rscore" dir="ltr">${escapeHtml(hoursText(person.seconds))}</span>` +
        '</div>'
      );
    })
    .join('');
}

function rowHtml(person, rank) {
  const mine = isMe(person);
  const name = mine ? `${person.name} (إنت)` : person.name;

  return (
    `<div class="rrow${mine ? ' mine' : ''}">` +
    `<span class="rrank">${rank}</span>` +
    `<span class="rface small">${escapeHtml(initialsOf(person.name))}</span>` +
    `<span class="rname" dir="auto">${escapeHtml(name)}</span>` +
    `<span class="rhours" dir="ltr">${escapeHtml(hoursText(person.seconds))}</span>` +
    '</div>'
  );
}

// Filtering to one person hides everyone else but keeps the rank they hold on
// the full board — a leaderboard where the only row left is always first would
// be answering a different question.
function shown(people) {
  const ranked = people.map((person, index) => ({ person, rank: index + 1 }));
  if (!context.person) return ranked;
  return ranked.filter(({ person }) => (person.id || person.name) === context.person);
}

function noteText(board) {
  const parts = [`${board.issues} تاسك`, `${board.entries} تسجيلة`];
  if (board.cappedPages) parts.push('⚠ الشغل أكتر من اللي اتقرا');
  if (board.missedIssues) parts.push(`⚠ ${board.missedIssues} تاسك مقروش كاملين`);
  return parts.join('  ·  ');
}

function paintPeople() {
  const board = context.board;
  if (!board) return;

  const rows = shown(board.people);
  const podium = context.person ? [] : board.people.slice(0, PODIUM);

  elements.rpodium.innerHTML = podiumHtml(podium);
  elements.rpodium.style.display = podium.length ? 'flex' : 'none';

  const rest = context.person ? rows : rows.slice(PODIUM);
  elements.rlist.innerHTML = rest.length
    ? rest.map(({ person, rank }) => rowHtml(person, rank)).join('')
    : '<div class="rempty">مفيش حد سجّل شغل في الفترة دي.</div>';
}

function paintFilters() {
  [...elements.rspan.children].forEach((chip) => {
    chip.classList.toggle('on', Number(chip.dataset.d) === context.days);
  });
  elements.rdates.style.display = context.days === CUSTOM ? 'flex' : 'none';
}

function remember() {
  window.tayf.savePreferences({ rank: { scope: context.scope, days: context.days } });
}

async function load() {
  const { from, to } = activeRange();
  if (!from || !to || from > to) {
    elements.rnote.textContent = 'المدى مش مظبوط — تاريخ البداية بعد النهاية.';
    return;
  }

  const requestId = ++context.requestId;
  context.loading = true;
  elements.rnote.textContent = 'بيحسب…';

  const response = await window.tayf.leaderboard({
    projectKey: context.scope === ALL_PROJECTS ? null : context.scope,
    from,
    to
  });

  if (requestId !== context.requestId) return;
  context.loading = false;

  if (response.error) {
    context.board = null;
    elements.rpodium.innerHTML = '';
    elements.rlist.innerHTML = '';
    elements.rnote.textContent = response.error;
    return;
  }

  context.board = response.board;
  personSelect.setOptions(
    [
      { id: '', label: 'الكل' },
      ...response.board.people.map((person) => ({
        id: person.id || person.name,
        label: person.name
      }))
    ],
    context.person
  );

  paintPeople();
  elements.rnote.textContent = noteText(response.board);
  setFooterMeta('metar', `${from} → ${to}`);
}

async function loadProjects() {
  const response = await window.tayf.projects();
  const projects = response.error ? [] : response.projects || [];

  scopeSelect.setOptions(
    [
      { id: ALL_PROJECTS, label: 'كل المشاريع' },
      ...projects.map((project) => ({ id: project.key, label: `${project.key} — ${project.name}` }))
    ],
    context.scope
  );
}

function chooseSpan(days) {
  if (context.days === days) return;
  context.days = days;
  paintFilters();
  remember();

  if (days === CUSTOM) {
    if (!context.from) context.from = isoDaysAgo(14);
    if (!context.to) context.to = toIsoDate(new Date());
    elements.rfrom.value = context.from;
    elements.rto.value = context.to;
  }
  load();
}

export function openScope() {
  elements.rscope.querySelector('.sel-trigger').click();
}

export function openPerson() {
  elements.rwho.querySelector('.sel-trigger').click();
}

export function refresh() {
  if (!context.loading) load();
}

export function pickSpan(index) {
  const chip = elements.rspan.children[index];
  if (chip) chooseSpan(Number(chip.dataset.d));
}

export const leaderboardScreen = {
  name: 'leaderboard',

  async enter() {
    this.render();
    elements.search.blur();
    paintFilters();

    if (!context.board) {
      elements.rnote.textContent = 'بيحسب…';
      await loadProjects();
    }
    await load();
  },

  leave() {
    context.requestId += 1;
    context.loading = false;
  },

  render() {
    showLayout('leaderboard');
    paintBanners();
    state.rows = [];
  }
};

scopeSelect = createSelect('rscope', {
  searchable: true,
  emptyLabel: 'كل المشاريع',
  onChange: (value) => {
    context.scope = value || ALL_PROJECTS;
    context.person = '';
    remember();
    load();
  }
});

personSelect = createSelect('rwho', {
  searchable: true,
  emptyLabel: 'الكل',
  onChange: (value) => {
    context.person = value || '';
    paintPeople();
  }
});

elements.rspan.addEventListener('click', (event) => {
  const chip = event.target.closest('.rchip');
  if (chip) chooseSpan(Number(chip.dataset.d));
});

[elements.rfrom, elements.rto].forEach((input) => {
  input.addEventListener('change', () => {
    context.from = elements.rfrom.value || null;
    context.to = elements.rto.value || null;
    if (context.from && context.to) load();
  });
});

export function adoptRankPreferences(preferences) {
  const rank = (preferences && preferences.rank) || {};
  if (rank.scope) context.scope = rank.scope;
  if (SPANS.includes(rank.days) || rank.days === CUSTOM) context.days = rank.days;
  paintFilters();
}
