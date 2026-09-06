# Releasing

A release is a tag. Everything else follows from it.

There are two ways to get the files onto GitHub: the workflow builds them, or you do.
The workflow is the intended path; the manual one exists because it is currently the
only one that works.

## Before the tag

1. `main` has everything you want to ship, and `npm run lint` and `npm test` pass on it.
2. **Close the changelog in its own commit.** Rename `## [Unreleased]` to
   `## [x.y.z] - YYYY-MM-DD`, leave a fresh empty `## [Unreleased]` above it, and commit
   that alone — `Close the changelog for x.y.z`. Doing it in the same commit as the
   version bump makes the release notes harder to find later.
3. Pick the number. While Tayf is on `0.x`, **a minor bump is a feature and a patch is a
   fix**. A release with any feature in it is a minor bump, however small.

## Cutting it

```bash
npm version minor        # or: npm version patch
git push --follow-tags
```

`npm version` bumps `package.json`, commits, and tags `v<version>` — one step, so the
tag and the declared version cannot drift apart. The workflow checks they match and
fails fast if they do not, which is the whole reason not to tag by hand.

## What has to be on the release

| File | What breaks without it |
| --- | --- |
| `Tayf-Setup-<version>.exe` | nothing to install |
| `Tayf-Setup-<version>.exe.blockmap` | every update downloads the full ~95 MB instead of the changed parts |
| `latest.yml` | installed copies never see the update at all — this is the feed they read |
| `Tayf-arm64.dmg`, `Tayf-x64.dmg` | macOS has nothing to download (it is a manual download either way, see below) |

## Path A — the workflow builds it

Pushing a `v*` tag runs [`.github/workflows/release.yml`](../.github/workflows/release.yml)
on Windows and macOS. It verifies the tag against `package.json`, runs lint and tests,
then `npx electron-builder --publish always`, which uploads to a **draft** release
(`publish.releaseType: draft` in `electron-builder.yml`).

Draft is deliberate: a release goes public only once every file is on it, so installed
copies never poll a feed that is missing half its assets. Write the notes from
`CHANGELOG.md`, then publish it.

## Path B — you build it

**This is the current path.** The GitHub account is locked for billing, so Actions never
start: every run fails within a few seconds. Until that is paid, build on your own
machine.

```bash
npx electron-builder --win --publish never

gh release create v0.10.0 \
  dist/Tayf-Setup-0.10.0.exe \
  dist/Tayf-Setup-0.10.0.exe.blockmap \
  dist/latest.yml \
  --draft --title "v0.10.0" --notes-file notes.md
```

Then check the draft has all three files, and publish:

```bash
gh release view v0.10.0
gh release edit v0.10.0 --draft=false
```

## The four ways this has gone wrong

**Naming the assets with a glob.** `dist/` is never cleaned, so it still holds every
installer and blockmap back to 0.3.0. By 0.6.0 `dist/*.blockmap` matched four old files
and would have uploaded all of them. **Always write the filenames out in full.**

**`--publish always` from your machine.** Two publishers race and create two releases.
That is how 0.4.0 ended up with its blockmap sitting on a stray draft while the real
release went out without one. Locally it is always `--publish never`.

**Publishing before the assets are up.** `gh release create` uploads after it creates
the release, so a non-draft release is briefly live with no `latest.yml`. Create it as a
draft and flip it after.

**Forgetting the blockmap.** It is easy to miss because nothing looks broken — the
update still installs. It just pulls the whole installer every time.

## macOS

The `.dmg` needs a Mac to build; `--win` from Windows will not produce one. It is a
manual download regardless: the app is unsigned (`identity: null`), and Squirrel refuses
to update an unsigned app, so macOS never updates itself. Signing it later also means
adding a `zip` target — macOS updates are served from the zip, not the dmg.

## If a release goes out wrong

Delete the release and the tag, fix, and cut it again with the same number — nobody has
it yet if you catch it quickly, and burning a version number over a bad upload is worse
than reusing one.

```bash
gh release delete v0.10.0 --yes
git push origin :refs/tags/v0.10.0
git tag -d v0.10.0
```

Once a release has been public long enough for a copy to have updated to it, do not
reuse the number. Cut a patch on top instead.
