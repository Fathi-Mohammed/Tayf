import elements from '../elements.js';
import { state, clampSelection, isInHand } from '../state.js';
import { goTo } from '../navigation.js';
import { showLayout, setContext, paintBanners, setFooterMeta, itemCountMeta } from '../chrome.js';
import { itemRowHtml } from '../list-view.js';
import { toIsoDate } from '../dates.js';
import { escapeHtml } from '../format.js';
import { groupItemsByProject, projectKey } from '../project-groups.js';

const SETUP_STEPS =
  '<h3>وصّلها بـ Jira بتاعك</h3>' +
  '<ol>' +
  '<li>اعمل API Token من <code>id.atlassian.com/manage-profile/security/api-tokens</code></li>' +
  '<li>افتح الإعدادات من أيقونة الساعة</li>' +
  '<li>املا الموقع والإيميل والتوكن</li>' +
  '</ol>' +
  '<span class="note">الملف على جهازك بس. التوكن مبيتبعتش لأي حد.</span>';

export const FILTERS = ['all', 'today', 'late', 'wip'];
const collapsedProjects = new Set();
let lastKeyboardCollapse = null;

const MATCHES_FILTER = {
  all: () => true,
  today: (item, today) => !!item.due && item.due <= today,
  late: (item, today) => !!item.due && item.due < today,
  wip: (item) => isInHand(item)
};

export function visibleItems() {
  const today = toIsoDate(new Date());
  const query = elements.search.value.trim().toLowerCase();

  const filtered = state.workspace.items.filter((item) =>
    MATCHES_FILTER[state.filter](item, today)
  );
  if (!query) return filtered;

  return filtered.filter((item) => {
    const boards = (item.boards || []).map((board) => board.name).join(' ');
    const haystack = `${item.key} ${item.projectName || ''} ${item.title} ${item.type || ''} ${boards}`;
    return haystack.toLowerCase().includes(query);
  });
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

function projectHeaderHtml(group, expanded) {
  const count = `${group.items.length} ${group.items.length === 1 ? 'تاسك' : 'تاسكات'}`;
  return (
    `<button class="project-toggle" type="button" tabindex="-1" ` +
    `data-project-key="${escapeHtml(group.key)}" aria-expanded="${expanded}">` +
    '<span class="project-chevron" aria-hidden="true"></span>' +
    `<span class="project-name">${escapeHtml(group.name)}</span>` +
    `<span class="project-key">${escapeHtml(group.key)}</span>` +
    `<span class="project-count">${count}</span></button>`
  );
}

function paintProjectGroups(items, emptyMessage, restoreKey) {
  const groups = groupItemsByProject(items);
  const expandedRows = groups.flatMap((group) =>
    collapsedProjects.has(group.key) ? [] : group.items
  );
  const previousIndex = state.selectedIndex;

  state.rows = expandedRows;
  const restoredIndex = restoreKey
    ? expandedRows.findIndex((item) => item.key === restoreKey)
    : -1;
  if (restoredIndex >= 0) state.selectedIndex = restoredIndex;
  else state.selectedIndex = previousIndex;
  clampSelection();

  if (!items.length) {
    elements.list.style.display = 'none';
    elements.msg.style.display = 'block';
    elements.msg.innerHTML = `<span class="dim">${escapeHtml(emptyMessage)}</span>`;
    return;
  }

  elements.msg.style.display = 'none';
  elements.list.style.display = 'block';

  let rowIndex = 0;
  elements.list.innerHTML = groups.map((group) => {
    const expanded = !collapsedProjects.has(group.key);
    const rows = expanded
      ? group.items.map((item) => itemRowHtml(item, rowIndex++ === state.selectedIndex)).join('')
      : '';
    return projectHeaderHtml(group, expanded) + rows;
  }).join('');

  const selected = elements.list.querySelector('.row.on');
  if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: 'nearest' });
}

export const taskListScreen = {
  name: 'tasks',

  enter({ restoreKey } = {}) {
    setContext('');
    elements.search.value = '';
    elements.search.placeholder = 'دوّر على تاسك';

    const rows = visibleItems();
    const index = restoreKey ? rows.findIndex((row) => row.key === restoreKey) : -1;
    state.selectedIndex = index >= 0 ? index : 0;

    this.render({ restoreKey });
    elements.search.focus();
  },

  render({ restoreKey } = {}) {
    showLayout('tasks');
    paintBanners();

    if (!state.workspace.configured) {
      elements.list.style.display = 'none';
      elements.msg.style.display = 'block';
      elements.msg.innerHTML = SETUP_STEPS;
      state.rows = [];
      setFooterMeta('meta', '');
      return;
    }

    const rows = visibleItems();
    const empty = elements.search.value ? 'مفيش نتايج.' : 'مفيش تاسكات مسندة ليك.';
    paintProjectGroups(rows, empty, restoreKey);
    setFooterMeta('meta', itemCountMeta());
  }
};

export function collapseSelectedProject() {
  const item = state.rows[state.selectedIndex];
  if (!item) return false;

  const key = projectKey(item);
  lastKeyboardCollapse = { projectKey: key, taskKey: item.key };
  collapsedProjects.add(key);
  taskListScreen.render();
  const header = Array.from(elements.list.querySelectorAll('.project-toggle')).find(
    (candidate) => candidate.dataset.projectKey === key
  );
  if (header && header.scrollIntoView) header.scrollIntoView({ block: 'nearest' });
  elements.search.focus();
  return true;
}

export function expandLastCollapsedProject() {
  if (!lastKeyboardCollapse) return false;

  const { projectKey: key, taskKey } = lastKeyboardCollapse;
  if (!collapsedProjects.has(key)) return false;

  collapsedProjects.delete(key);
  lastKeyboardCollapse = null;
  taskListScreen.render({ restoreKey: taskKey });
  elements.search.focus();
  return true;
}

elements.list.addEventListener('click', (event) => {
  const toggle = event.target.closest('.project-toggle');
  if (!toggle) return;

  const selectedKey = state.rows[state.selectedIndex] && state.rows[state.selectedIndex].key;
  const key = toggle.dataset.projectKey;
  if (collapsedProjects.has(key)) {
    collapsedProjects.delete(key);
    if (lastKeyboardCollapse && lastKeyboardCollapse.projectKey === key) {
      lastKeyboardCollapse = null;
    }
  } else {
    collapsedProjects.add(key);
  }

  taskListScreen.render({ restoreKey: selectedKey });
  elements.search.focus();
});

export function backToTaskList(restoreKey) {
  return goTo('tasks', { restoreKey });
}
