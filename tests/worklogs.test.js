'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { jqlFor, tally, toEntry } = require('../src/providers/jira/worklogs');

function worklog(id, accountId, name, started, seconds) {
  return {
    id,
    author: { accountId, displayName: name },
    started,
    timeSpentSeconds: seconds
  };
}

const RANGE = { from: '2026-08-23', to: '2026-09-05' };

test('the JQL never orders by updated, which shifts under a paging loop', () => {
  const jql = jqlFor({ projectKey: 'FPE', ...RANGE });
  assert.match(jql, /ORDER BY key ASC$/);
  assert.doesNotMatch(jql, /updated/);
});

test('a project narrows the JQL and no project leaves it instance-wide', () => {
  assert.match(jqlFor({ projectKey: 'FPE', ...RANGE }), /^project = "FPE" AND worklogDate/);
  assert.match(jqlFor({ projectKey: null, ...RANGE }), /^worklogDate >= "2026-08-23"/);
});

test('a project key cannot break out of its quotes', () => {
  assert.doesNotMatch(jqlFor({ projectKey: 'F" OR key = "X', ...RANGE }), /OR key = "X"/);
});

test('worklogs sum per person, newest first', () => {
  const entries = [
    worklog('1', 'omar', 'Omar Osama', '2026-09-01T09:00:00.000+0300', 3600),
    worklog('2', 'omar', 'Omar Osama', '2026-09-02T09:00:00.000+0300', 7200),
    worklog('3', 'sara', 'Sara Ali', '2026-09-02T09:00:00.000+0300', 1800)
  ].map(toEntry);

  const { people, totalSeconds } = tally(entries, RANGE);

  assert.deepEqual(
    people.map((one) => [one.name, one.seconds]),
    [
      ['Omar Osama', 10800],
      ['Sara Ali', 1800]
    ]
  );
  assert.equal(totalSeconds, 12600);
});

test('the same worklog served on two pages is counted once', () => {
  const one = toEntry(worklog('7', 'omar', 'Omar Osama', '2026-09-01T09:00:00.000+0300', 3600));
  const { people, totalSeconds, entries } = tally([one, { ...one }], RANGE);

  assert.equal(people.length, 1);
  assert.equal(people[0].seconds, 3600);
  assert.equal(totalSeconds, 3600);
  assert.equal(entries, 1);
});

test('worklogs outside the window are dropped, both ends', () => {
  const entries = [
    worklog('1', 'omar', 'Omar Osama', '2026-08-22T09:00:00.000+0300', 3600),
    worklog('2', 'omar', 'Omar Osama', '2026-09-06T09:00:00.000+0300', 3600),
    worklog('3', 'omar', 'Omar Osama', '2026-08-23T09:00:00.000+0300', 60)
  ].map(toEntry);

  const { people, totalSeconds } = tally(entries, RANGE);

  assert.equal(totalSeconds, 60);
  assert.equal(people[0].seconds, 60);
});

test('someone with no account id still lands under their own name', () => {
  const entries = [
    worklog('1', null, 'Ghost', '2026-09-01T09:00:00.000+0300', 600),
    worklog('2', null, 'Ghost', '2026-09-02T09:00:00.000+0300', 600),
    worklog('3', null, 'Other', '2026-09-02T09:00:00.000+0300', 600)
  ].map(toEntry);

  const { people } = tally(entries, RANGE);

  assert.equal(people.length, 2);
  assert.equal(people.find((one) => one.name === 'Ghost').seconds, 1200);
});

test('an empty window reports nothing rather than throwing', () => {
  assert.deepEqual(tally([], RANGE), { people: [], totalSeconds: 0, entries: 0 });
});
