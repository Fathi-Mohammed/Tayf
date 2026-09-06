'use strict';

const PAGE_SIZE = 100;
const MAX_PAGES = 40;
const MAX_TRUNCATED_FOLLOW_UPS = 25;
const FIELDS = 'worklog';

const ENDPOINT_GONE = new Set([404, 410]);

// Ordering by key, never by updated: logging work bumps updated, so a sort on it
// reshuffles the result set under the paging loop and serves the same issues on
// more than one page.
function jqlFor({ projectKey, from, to }) {
  const clauses = [`worklogDate >= "${from}"`, `worklogDate <= "${to}"`];
  if (projectKey) clauses.unshift(`project = "${String(projectKey).replace(/"/g, '')}"`);
  return `${clauses.join(' AND ')} ORDER BY key ASC`;
}

// /rest/api/3/search/jql pages by nextPageToken and ignores startAt entirely —
// sending startAt re-serves the first page, which counts every worklog on it
// once per request. Only the legacy endpoint pages by offset.
async function searchPage(client, jql, cursor) {
  const params = { jql, fields: FIELDS, maxResults: String(PAGE_SIZE) };

  if (cursor.legacy) {
    params.startAt = String(cursor.startAt);
    return client.get(`/rest/api/3/search?${new URLSearchParams(params).toString()}`);
  }

  if (cursor.token) params.nextPageToken = cursor.token;

  try {
    return await client.get(`/rest/api/3/search/jql?${new URLSearchParams(params).toString()}`);
  } catch (error) {
    if (!ENDPOINT_GONE.has(error.status)) throw error;
    cursor.legacy = true;
    return searchPage(client, jql, cursor);
  }
}

function dayOf(worklog) {
  return String(worklog.started || '').slice(0, 10);
}

function toEntry(worklog) {
  const author = worklog.author || {};
  return {
    id: worklog.id || null,
    personId: author.accountId || null,
    name: author.displayName || '',
    day: dayOf(worklog),
    seconds: Number(worklog.timeSpentSeconds) || 0
  };
}

// Pure on purpose: the paging above is what the probe exercises against a real
// Jira, and this is what the tests pin down.
function tally(entries, { from, to }) {
  const seen = new Set();
  const people = new Map();
  let totalSeconds = 0;
  let counted = 0;

  entries.forEach((entry) => {
    if (entry.id) {
      if (seen.has(entry.id)) return;
      seen.add(entry.id);
    }
    if (!entry.day || entry.day < from || entry.day > to) return;

    const id = entry.personId || `name:${entry.name}`;
    const person = people.get(id) || { id: entry.personId, name: entry.name, seconds: 0, days: 0 };
    person.seconds += entry.seconds;
    person.days += 1;
    if (!person.name && entry.name) person.name = entry.name;
    people.set(id, person);

    totalSeconds += entry.seconds;
    counted += 1;
  });

  const ranked = [...people.values()].sort(
    (one, two) => two.seconds - one.seconds || one.name.localeCompare(two.name)
  );

  return { people: ranked, totalSeconds, entries: counted };
}

async function fetchLeaderboard(client, { projectKey = null, from, to }) {
  const jql = jqlFor({ projectKey, from, to });
  const cursor = { legacy: false, token: null, startAt: 0 };

  const entries = [];
  const truncated = [];
  const issues = new Set();
  let requests = 0;
  let cappedPages = true;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await searchPage(client, jql, cursor);
    requests += 1;

    const found = response.issues || [];
    found.forEach((issue) => {
      if (issues.has(issue.key)) return;
      issues.add(issue.key);

      const field = (issue.fields && issue.fields.worklog) || {};
      const embedded = field.worklogs || [];
      embedded.forEach((worklog) => entries.push(toEntry(worklog)));

      const claimed = Number(field.total) || embedded.length;
      if (claimed > embedded.length) truncated.push(issue.key);
    });

    cursor.token = response.nextPageToken || null;
    cursor.startAt += found.length;

    const done = cursor.legacy ? found.length < PAGE_SIZE : !cursor.token || response.isLast;
    if (done) {
      cappedPages = false;
      break;
    }
  }

  // Jira embeds only the first slice of an issue's worklogs in a search result.
  // A handful of busy issues is normal; a flood of them means the numbers would
  // be wrong, so the count is bounded and the shortfall is reported rather than
  // quietly dropped.
  const chased = truncated.slice(0, MAX_TRUNCATED_FOLLOW_UPS);
  for (const key of chased) {
    const page = await client.get(
      `/rest/api/3/issue/${encodeURIComponent(key)}/worklog?maxResults=1000`
    );
    requests += 1;
    (page.worklogs || []).forEach((worklog) => entries.push(toEntry(worklog)));
  }

  const missed = truncated.length - chased.length;
  const { people, totalSeconds, entries: counted } = tally(entries, { from, to });

  return {
    from,
    to,
    projectKey,
    people,
    totalSeconds,
    entries: counted,
    issues: issues.size,
    requests,
    partial: cappedPages || missed > 0,
    cappedPages,
    missedIssues: missed
  };
}

module.exports = { fetchLeaderboard, jqlFor, tally, toEntry, PAGE_SIZE, MAX_PAGES };
