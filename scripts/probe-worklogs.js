'use strict';

// Runs the real leaderboard fetch against a real Jira and prints what it cost.
//
// Everything below the credentials is the same code path the app uses — this
// exists so the numbers can be checked before a screen is built on top of them.
//
//   node scripts/probe-worklogs.js                  list the projects
//   node scripts/probe-worklogs.js FPE 14           one project, last 14 days
//   node scripts/probe-worklogs.js all 30           every project you can see
//
// Read-only: GETs only. Nothing is written to Jira.

const path = require('path');
const fs = require('fs');
const os = require('os');
const { JiraClient } = require('../src/providers/jira/client');
const { fetchProjects } = require('../src/providers/jira/metadata');
const { fetchLeaderboard, jqlFor } = require('../src/providers/jira/worklogs');

const DEFAULT_DAYS = 14;

function appDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Tayf');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Tayf');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Tayf');
}

function readCredentials() {
  const candidates = [
    path.join(__dirname, '..', 'config.json'),
    path.join(appDataDir(), 'config.json')
  ];
  const found = candidates.find((one) => fs.existsSync(one));

  if (!found) {
    console.log('no config.json in either place:');
    candidates.forEach((one) => console.log(`  ${one}`));
    process.exit(1);
  }

  console.log(`credentials: ${found}\n`);
  const stored = JSON.parse(fs.readFileSync(found, 'utf8'));
  return {
    site: String(stored.site || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
    email: String(stored.email || '').trim(),
    token: String(stored.token || '').trim()
  };
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hours(seconds) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

function listProjects(projects) {
  console.log('projects you can see:\n');
  projects.forEach((project) => console.log(`  ${project.key.padEnd(12)} ${project.name}`));
  console.log('\nrun again with one of those keys, or "all" for every project.');
}

// An unknown key comes back as an empty page rather than an error on the newer
// search endpoint, which reads exactly like "nobody logged any work" — so the
// key is checked against the real list before a zero is believed.
async function resolveProject(client, wanted) {
  if (wanted.toLowerCase() === 'all') {
    console.log('project: every project you can see\n');
    return null;
  }

  const projects = await fetchProjects(client);
  const match = projects.find((one) => one.key.toLowerCase() === wanted.toLowerCase());

  if (!match) {
    console.log(`✗ no project with the key "${wanted}"\n`);
    listProjects(projects);
    process.exit(1);
  }

  console.log(`project: ${match.key} — ${match.name}\n`);
  return match.key;
}

async function main() {
  const wanted = (process.argv[2] || '').trim();
  const days = Number(process.argv[3]) || DEFAULT_DAYS;
  const client = new JiraClient(readCredentials());

  if (!wanted) {
    console.log('usage: node scripts/probe-worklogs.js <PROJECT-KEY|all> [days]\n');
    listProjects(await fetchProjects(client));
    process.exit(1);
  }

  const projectKey = await resolveProject(client, wanted);
  const range = { projectKey, from: isoDaysAgo(days), to: today() };

  console.log(`JQL: ${jqlFor(range)}\n`);

  const started = Date.now();
  const board = await fetchLeaderboard(client, range);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log('=== cost ===');
  console.log(`  requests        ${board.requests}   (${elapsed}s)`);
  console.log(`  unique issues   ${board.issues}`);
  console.log(`  worklog entries ${board.entries} counted in the window`);

  if (board.cappedPages) {
    console.log('  ⚠ stopped at the page cap — there is more work than this shows');
  }
  if (board.missedIssues) {
    console.log(`  ⚠ ${board.missedIssues} busy issues went unread past the follow-up cap`);
  }
  if (!board.partial) {
    console.log('  ✓ complete — every issue and every worklog in the window was read');
  }

  console.log(`\n=== ${range.from} → ${range.to} ===`);
  console.log(`  total ${hours(board.totalSeconds)} across ${board.people.length} people\n`);

  const longest = board.people.reduce((most, one) => Math.max(most, one.name.length), 0);
  board.people.forEach((person, index) => {
    const medal = ['🥇', '🥈', '🥉'][index] || '  ';
    const perDay = hours(person.seconds / days);
    console.log(
      `  ${medal} ${String(index + 1).padStart(2)}. ${person.name.padEnd(longest)} ` +
        `${hours(person.seconds).padStart(7)}   ${perDay.padStart(6)}/day`
    );
  });

  if (!board.people.length) console.log('  nobody logged work in this window');
}

main().catch((error) => console.log(`\n✗ ${error.message}`));
