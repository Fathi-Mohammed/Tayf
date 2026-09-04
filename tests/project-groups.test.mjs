import test from 'node:test';
import assert from 'node:assert/strict';

import { groupItemsByProject, projectName } from '../src/renderer/project-groups.js';

test('groupItemsByProject keeps project and task order stable', () => {
  const items = [
    { key: 'WEB-2', projectKey: 'WEB', projectName: 'Website' },
    { key: 'APP-1', projectKey: 'APP', projectName: 'Mobile app' },
    { key: 'WEB-1', projectKey: 'WEB', projectName: 'Website' }
  ];

  const groups = groupItemsByProject(items);

  assert.deepEqual(groups.map((group) => group.key), ['WEB', 'APP']);
  assert.deepEqual(groups[0].items.map((item) => item.key), ['WEB-2', 'WEB-1']);
  assert.equal(groups[0].name, 'Website');
});

test('projectName falls back to board metadata and then the project key', () => {
  assert.equal(projectName({
    key: 'OPS-1',
    projectKey: 'OPS',
    boards: [{ projectKey: 'OPS', projectName: 'Operations' }]
  }), 'Operations');
  assert.equal(projectName({ key: 'OPS-2', projectKey: 'OPS' }), 'OPS');
});
