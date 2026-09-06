import test from 'node:test';
import assert from 'node:assert/strict';
import { todayProgress } from '../src/renderer/progress.js';

const TODAY = '2026-09-06';

const open = (key, due) => ({ key, due, category: 'indeterminate' });
const closed = (key, due) => ({ key, due, category: 'done' });

test('a task closed today counts towards the ring instead of vanishing from it', () => {
  // ده كان الباج: assignedItems بيستبعد المقفول، فالتاسك بتختفي من items
  // والحلقة ترجع 0/0 بدل 1/1.
  assert.deepEqual(todayProgress([], [closed('TAYF-1', TODAY)], TODAY), { done: 1, total: 1 });
});

test('open and closed work sit in the same denominator', () => {
  const items = [open('TAYF-1', TODAY), open('TAYF-2', '2026-09-04')];
  const done = [closed('TAYF-3', TODAY)];
  assert.deepEqual(todayProgress(items, done, TODAY), { done: 1, total: 3 });
});

test('work due later than today is not on the plate yet', () => {
  const items = [open('TAYF-1', TODAY), open('TAYF-2', '2026-09-20')];
  assert.deepEqual(todayProgress(items, [], TODAY), { done: 0, total: 1 });
});

test('work with no due date is counted on neither side', () => {
  const items = [open('TAYF-1', null), open('TAYF-2', TODAY)];
  assert.deepEqual(todayProgress(items, [closed('TAYF-3', null)], TODAY), { done: 0, total: 1 });
});

test('the optimistic move counts before the read comes back', () => {
  // بين ما تنقل التاسك وما القراية ترجع، الحالة بتتغيّر في items نفسها.
  const items = [{ key: 'TAYF-1', due: TODAY, category: 'done' }];
  assert.deepEqual(todayProgress(items, [], TODAY), { done: 1, total: 1 });
});

test('the same task in both lists is one task, not two', () => {
  // بعد ما القراية ترجع التاسك بتبقى في closedToday، وممكن تكون لسه في items
  // من التحديث التفاؤلي — من غير التوحيد كانت هتبقى 2/2.
  const items = [{ key: 'TAYF-1', due: TODAY, category: 'done' }];
  assert.deepEqual(todayProgress(items, [closed('TAYF-1', TODAY)], TODAY), { done: 1, total: 1 });
});

test('an empty plate reports nothing rather than dividing by zero', () => {
  assert.deepEqual(todayProgress([], [], TODAY), { done: 0, total: 0 });
  assert.deepEqual(todayProgress(undefined, undefined, TODAY), { done: 0, total: 0 });
});
