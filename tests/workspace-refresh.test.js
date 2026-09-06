'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Workspace } = require('../src/app/workspace');

function emptyCache() {
  return {
    read: () => ({
      items: [],
      fetchedAt: null,
      boardsByItemKey: {},
      transitionsNeedingWorklog: []
    }),
    write: () => {}
  };
}

// كل قراية بترجّع عنصر باسم الدور بتاعها، فنقدر نعرف آخر واحدة وصلت للحالة.
function createProvider() {
  const provider = {
    reads: 0,
    release: null,
    currentUser: async () => ({ accountId: 'me', name: 'Fathy' }),
    boardsByItemKey: async () => ({}),
    closedToday: async () => [],
    assignedItems() {
      provider.reads += 1;
      const round = provider.reads;
      return new Promise((resolve) => {
        provider.release = () => resolve([{ key: `TASK-${round}`, boards: null }]);
      });
    }
  };
  return provider;
}

function createWorkspace() {
  const workspace = new Workspace({ cache: emptyCache(), log: { appendLine: () => {} } });
  const provider = createProvider();
  workspace.useProvider(provider);
  return { workspace, provider };
}

// وعد بينحل بعد ما الميكروتاسكات الجارية تخلص، عشان الـ then المتسلسلة تجري.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('a refresh asked for while one is running runs again instead of being dropped', async () => {
  const { workspace, provider } = createWorkspace();

  const first = workspace.refresh();
  await settle();
  assert.equal(provider.reads, 1);

  const second = workspace.refresh();
  provider.release();
  await first;

  await settle();
  assert.equal(provider.reads, 2, 'the queued request should start its own read');

  provider.release();
  await second;
  assert.deepEqual(workspace.state.items.map((item) => item.key), ['TASK-2']);
});

test('several requests during one run collapse into a single follow-up', async () => {
  const { workspace, provider } = createWorkspace();

  const first = workspace.refresh();
  await settle();

  const queued = [workspace.refresh(), workspace.refresh(), workspace.refresh()];
  assert.equal(queued[0], queued[1]);
  assert.equal(queued[1], queued[2]);

  provider.release();
  await first;
  await settle();
  provider.release();
  await Promise.all(queued);

  assert.equal(provider.reads, 2, 'three overlapping requests are one follow-up, not three');
});

test('the promise resolves only once the fresh items have landed', async () => {
  const { workspace, provider } = createWorkspace();

  let done = false;
  const refreshed = workspace.refresh().then(() => {
    done = true;
  });

  await settle();
  assert.equal(done, false);
  assert.deepEqual(workspace.state.items, []);

  provider.release();
  await refreshed;
  assert.deepEqual(workspace.state.items.map((item) => item.key), ['TASK-1']);
});

test('state carries refreshing while a read is in flight, so the overlay can say so', async () => {
  const { workspace, provider } = createWorkspace();
  const seen = [];
  workspace.on('change', (state) => seen.push(state.refreshing));

  assert.equal(workspace.state.refreshing, false);
  const refreshed = workspace.refresh();
  await settle();
  assert.equal(workspace.state.refreshing, true);

  provider.release();
  await refreshed;
  assert.equal(workspace.state.refreshing, false);
  // syncBoards بينشر كمان بعد ما يجيب البوردات، فبنتأكد من الشكل مش من العدد.
  assert.equal(seen[0], true);
  assert.equal(seen.at(-1), false);
  assert.equal(seen.filter(Boolean).length, 1, "refreshing goes up once per read");
});

test('a workspace with no provider reports itself unconfigured and not refreshing', async () => {
  const workspace = new Workspace({ cache: emptyCache(), log: { appendLine: () => {} } });

  await workspace.refresh();
  assert.equal(workspace.state.configured, false);
  assert.equal(workspace.state.refreshing, false);
});

test('work closed today is read alongside the open list, since the open list excludes it', async () => {
  const { workspace, provider } = createWorkspace();
  provider.closedToday = async () => [{ key: 'TASK-9', due: '2026-09-06', category: 'done' }];

  const refreshed = workspace.refresh();
  await settle();
  provider.release();
  await refreshed;

  assert.deepEqual(workspace.state.closedToday.map((item) => item.key), ['TASK-9']);
});

// القراية دي تكميلية — الحلقة بس هي اللي بتعتمد عليها، فمينفعش تسقّط القايمة.
test('a failing closed-today read keeps the last value and lets the list through', async () => {
  const { workspace, provider } = createWorkspace();
  provider.closedToday = async () => [{ key: 'TASK-9', due: '2026-09-06', category: 'done' }];

  const first = workspace.refresh();
  await settle();
  provider.release();
  await first;

  provider.closedToday = async () => {
    throw new Error('statusCategoryChangedDate is not supported');
  };
  const second = workspace.refresh();
  await settle();
  provider.release();
  await second;

  assert.equal(workspace.state.error, null, 'the list should still land');
  assert.deepEqual(workspace.state.items.map((item) => item.key), ['TASK-2']);
  assert.deepEqual(workspace.state.closedToday.map((item) => item.key), ['TASK-9']);
});

test('closed work is not cached, so yesterday cannot be counted as today', async () => {
  const cache = {
    read: () => ({
      items: [{ key: 'TASK-1' }],
      fetchedAt: 1,
      boardsByItemKey: {},
      transitionsNeedingWorklog: [],
      closedToday: [{ key: 'TASK-OLD', due: '2026-09-05', category: 'done' }]
    }),
    write: () => {}
  };

  const workspace = new Workspace({ cache, log: { appendLine: () => {} } });
  assert.deepEqual(workspace.state.closedToday, []);
});
