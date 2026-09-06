export const state = {
  workspace: {
    configured: false,
    error: null,
    failure: null,
    items: [],
    closedToday: [],
    fetchedAt: null,
    user: null,
    transitionsNeedingWorklog: [],
    workingStatuses: null
  },
  rows: [],
  selectedIndex: 0,
  filter: 'all',
  view: 'compact',
  boardId: null,
  busy: false
};

export function isInHand(item) {
  const statuses = state.workspace.workingStatuses;
  if (!Array.isArray(statuses) || !statuses.length) return item.category === 'indeterminate';
  return item.category !== 'done' && statuses.includes(item.status);
}

export function setWorkspace(next) {
  state.workspace = next;
}

export function clampSelection() {
  if (state.selectedIndex >= state.rows.length) {
    state.selectedIndex = Math.max(0, state.rows.length - 1);
  }
  if (state.selectedIndex < 0) state.selectedIndex = 0;
}

export function selectedRow() {
  return state.rows[state.selectedIndex] || null;
}
