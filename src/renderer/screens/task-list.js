import { t } from '../i18n.js';
import elements from '../elements.js';
import { state, clampSelection, isInHand } from '../state.js';
import { goTo } from '../navigation.js';
import { showLayout, setContext, paintBanners, setFooterMeta, itemCountMeta } from '../chrome.js';
import { paintRows, itemRowHtml } from '../list-view.js';
import { paintSidebar } from '../sidebar.js';
import { syncTicker } from '../board.js';
import { currentBoardName } from '../board-picker.js';
import { toIsoDate } from '../dates.js';

const SETUP_STEPS =
  t("<h3>وصّلها بـ Jira بتاعك</h3>") +
  '<ol>' +
  t("<li>اعمل API Token من <code>id.atlassian.com/manage-profile/security/api-tokens</code></li>") +
  t("<li>افتح الإعدادات من أيقونة الساعة</li>") +
  t("<li>املا الموقع والإيميل والتوكن</li>") +
  '</ol>' +
  t("<span class=\"note\">الملف على جهازك بس. التوكن مبيتبعتش لأي حد.</span>");

export const FILTERS = ['all', 'today', 'late', 'wip'];

const MATCHES_FILTER = {
  all: () => true,
  today: (item, today) => !!item.due && item.due <= today,
  late: (item, today) => !!item.due && item.due < today,
  wip: (item) => isInHand(item)
};

const SECTIONS = [
  { id: 'today', label: t("النهاردة"), tone: '', match: (item, today) => item.due === today },
  { id: 'late', label: t("متأخرة"), tone: 'late', match: (item, today) => !!item.due && item.due < today },
  { id: 'next', label: t("جاي"), tone: '', match: (item, today) => !!item.due && item.due > today },
  { id: 'none', label: t("من غير معاد"), tone: '', match: (item) => !item.due }
];

function onBoard(item) {
  if (state.boardId === null) return true;
  return (item.boards || []).some((board) => board.id === state.boardId);
}

export function visibleItems() {
  const today = toIsoDate(new Date());
  const query = elements.search.value.trim().toLowerCase();

  const filtered = state.workspace.items.filter(
    (item) => MATCHES_FILTER[state.filter](item, today) && onBoard(item)
  );
  if (!query) return filtered;

  return filtered.filter((item) => {
    const boards = (item.boards || []).map((board) => board.name).join(' ');
    const haystack = `${item.key} ${item.title} ${item.type || ''} ${boards}`;
    return haystack.toLowerCase().includes(query);
  });
}

function groupItems(items) {
  const today = toIsoDate(new Date());
  return SECTIONS.map((section) => ({
    section,
    items: items.filter((item) => section.match(item, today))
  })).filter((group) => group.items.length);
}

export function orderedItems() {
  return groupItems(visibleItems()).flatMap((group) => group.items);
}

export function setFilter(name) {
  state.filter = name;
  state.selectedIndex = 0;
  Array.from(elements.filters.children).forEach((chip) => {
    chip.classList.toggle('on', chip.dataset.f === name);
  });
  taskListScreen.render();
  elements.search.focus();
}

function paintBoardBar() {
  elements.brdname.textContent = currentBoardName();
  Array.from(elements.views.children).forEach((button) => {
    button.classList.toggle('on', button.dataset.v === state.view);
  });
}

export const taskListScreen = {
  name: 'tasks',

  enter({ restoreKey } = {}) {
    setContext('');
    elements.search.value = '';
    elements.search.placeholder = t("دوّر على تاسك");

    const rows = orderedItems();
    const index = restoreKey ? rows.findIndex((row) => row.key === restoreKey) : -1;
    state.selectedIndex = index >= 0 ? index : 0;

    this.render();
    elements.search.focus();
  },

  render() {
    showLayout('tasks');
    paintBanners();

    if (!state.workspace.configured) {
      elements.list.style.display = 'none';
      elements.msg.style.display = 'block';
      elements.msg.innerHTML = SETUP_STEPS;
      state.rows = [];
      setFooterMeta('meta', '');
      paintSidebar();
      syncTicker(false);
      return;
    }

    paintBoardBar();

    const groups = groupItems(visibleItems());
    const rows = groups.flatMap((group) => group.items);

    const headers = new Map();
    let at = 0;
    groups.forEach((group) => {
      headers.set(at, { ...group.section, count: group.items.length });
      at += group.items.length;
    });

    const empty = elements.search.value ? t("مفيش نتايج.") : t("مفيش تاسكات مسندة ليك.");
    paintRows(rows, empty, (item, index, selected) => itemRowHtml(item, selected, index), headers);
    clampSelection();
    setFooterMeta('meta', itemCountMeta());
    syncTicker(!!paintSidebar());
  }
};

export function backToTaskList(restoreKey) {
  return goTo('tasks', { restoreKey });
}
