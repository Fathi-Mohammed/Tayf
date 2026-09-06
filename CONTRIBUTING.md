# Contributing

*[بالعربي](CONTRIBUTING.ar.md)*

## Getting it running

Node 22 or newer.

```bash
npm install
cp config.example.json config.json   # fill in site, email, API token
npm start
```

`config.json` is gitignored. Get an API token from
[id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

If the connection fails, `npm run check-config` tells you what is wrong with the
file without printing your token.

```bash
npm test          # unit tests (node:test, no dependencies)
npm run lint      # eslint
npm run dist      # package for the current platform
```

There is **no build step**. The renderer is plain ES modules that Electron loads
directly, so what you edit is what runs.

## Before you change anything

Read [docs/architecture.md](docs/architecture.md) — five minutes, and it explains the
layer rule that the whole codebase depends on.

Then read [docs/jira-quirks.md](docs/jira-quirks.md). The code has no comments by
design, so every piece of "why is this written so strangely" knowledge lives there.
Several of those workarounds look removable and are not.

## House rules

**No comments.** The code should explain itself through names and small functions. If
something genuinely cannot be made obvious — an API that misbehaves, a platform
quirk — it belongs in `docs/jira-quirks.md`, not in a comment above the line.

**Identifiers and documentation in English.** User-facing strings stay in Arabic for
now; main-process strings live in `src/strings.js`.

**Respect the layer rule.** `renderer → preload → main → app → providers/storage`.
In particular: no Jira-shaped data (ADF, raw `customfield_*` payloads, Jira JSON)
may leave `src/providers/`, and the renderer may not import anything but its own
modules and `window.tayf`.

**Errors carry codes, not sentences.** Providers throw `JiraError` with a `code`.
Display text is looked up in `src/strings.js` at the IPC boundary. This is what keeps
translation to a single file.

**Test the pure parts.** Anything without I/O — parsing, mapping, date handling —
should have tests. Anything that touches the network usually should not.

## Adding things

**A new provider (GitHub, Azure DevOps, …):** add `src/providers/<name>/` exposing the
same surface as `JiraProvider`, and construct it in `src/main/index.js → connectProvider`.
Nothing above the provider layer should need to change. See
[ADR-0002](docs/adr/0002-provider-abstraction.md).

**Linux platform changes:** keep `src/main/platform/linux.js` aligned with the shape
of `windows.js` / `macos.js`, and test window focus and global shortcuts on both X11
and Wayland when possible. Linux compositors restore focus after the overlay is
hidden, so the adapter does not force another application's window to the front.

**A settings section:** add a `.snavitem` to `#snav` and a `.spane` of `.srow`s in
`index.html`, its ids to `elements.js`, and its name to `TABS` and `PANES` in
`screens/settings.js`. Reads and writes go through `readPreferences` /
`savePreferences` — one pair of IPC channels for every preference, so a new section does
not mean a new channel.

**A new screen:** create `src/renderer/screens/<name>.js` exporting
`{ name, enter, leave, render }`, add its layout to `SCREEN_PARTS` in `chrome.js`,
register it in `app.js`, and add a key handler in `keyboard.js` if it needs one.

## Pull requests

- One concern per PR.
- `npm test` and `npm run lint` pass.
- If you changed behaviour, say so explicitly — this tool is used daily and silent
  behaviour changes are worse than bugs.
- If you worked around something Jira or an OS does wrong, add it to
  `docs/jira-quirks.md` in the same PR. That file is the point.

## Branches and releases

`main` is always releasable. Work happens on short-lived branches — `feat/...`,
`fix/...`, `docs/...` — squash-merged through a PR once CI is green, then deleted.
There is no `develop` or `release/*` branch. If a shipped version ever needs a fix
while `main` has moved on, branch from the tag.

A release is a tag. Bumping the version, committing and tagging is one command:

```bash
npm version minor
git push --follow-tags
```

Pushing the tag runs `.github/workflows/release.yml`: it builds on Windows and macOS
and uploads to a **draft** GitHub Release. Draft, so that installed copies never see an
update feed that is missing half its files. Write the notes from `CHANGELOG.md`, then
publish the release.

The tag and the `version` field in `package.json` must match; the workflow fails fast
if they do not, which is what `npm version` is there to prevent.

**[docs/releasing.md](docs/releasing.md)** has the rest: which files have to be on a
release and what breaks without each one, how to build and upload by hand when the
workflow cannot run, and the handful of ways this has gone wrong before.

Updates are checked by `src/main/updates.js`, which is deliberately inert unless the
app is packaged **and** running on Windows — see the known limitations in
[CHANGELOG.md](CHANGELOG.md).

## Reporting bugs

Include your OS, whether it is a dev run or a packaged build, and the relevant part of
the error log (tray icon → **سجل الأخطاء**). **Never paste your API token** — the log
does not contain it, and neither should your issue.
