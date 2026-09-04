const UNKNOWN_PROJECT = 'مشروع آخر';

export function projectKey(item) {
  return item.projectKey || String(item.key || '').split('-')[0] || 'other';
}

export function projectName(item) {
  if (item.projectName) return item.projectName;

  const matchingBoard = (item.boards || []).find(
    (board) => board.projectKey === projectKey(item) && board.projectName
  );
  return (matchingBoard && matchingBoard.projectName) || projectKey(item) || UNKNOWN_PROJECT;
}

export function groupItemsByProject(items) {
  const groups = new Map();

  items.forEach((item) => {
    const key = projectKey(item);
    if (!groups.has(key)) {
      groups.set(key, { key, name: projectName(item), items: [] });
    }
    groups.get(key).items.push(item);
  });

  return [...groups.values()];
}
