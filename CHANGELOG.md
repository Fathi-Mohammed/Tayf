# Changelog

Notable changes to Tayf. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
While Tayf is on 0.x, a minor bump is a feature and a patch is a fix.

## [Unreleased]

### Added

- **Comments, read and written from the overlay.** The task page now shows the five
  newest comments under the description — author, how long ago, and the text — and
  `C` jumps to a box at the bottom where `Ctrl+Enter` posts one. The new comment
  appears in place, so nothing about a quick reply needs a browser tab. They are
  fetched from the comment endpoint newest-first rather than read off the issue, which
  is what keeps a task with forty comments from showing its five oldest.

- **A meeting, in one keystroke — `Ctrl+M`.** It opens the ordinary create form with
  every field already answered: the title reads `Meeting`, the start date and the due
  date are today, an hour goes into the estimate, and the board is the last one a task
  was created on. Nothing is locked — they are the same inputs as always, only filled
  in — so a meeting that ate an hour is `Ctrl+Space`, `Ctrl+M`, `Enter`.

- Electron's default menu is replaced with an Edit-only one, plus the application menu
  on macOS. The default menu bound `Ctrl+M` to Minimize — a frameless overlay that
  minimises is a lost overlay — along with `Ctrl+R` reload and `Ctrl+W` close, neither
  of which an overlay has any use for. Cut, copy, paste and select-all keep their
  roles, which is where macOS gets those keys from.

### Fixed

- Leaving the create form and coming back to it lost the custom date and option rows.
  They are cleared on the way out but were only redrawn when the board or the type
  changed, so a second visit had none of them. They are redrawn on the way in now.

- The due date and the estimate no longer survive from one create form to the next.
  The fields were never cleared, so yesterday's date could ride along into a new task.

## [0.8.0] - 2026-09-05

### Added

- **The overlay's look is yours to set.** A fourth settings tab, المظهر (Ctrl+4).
  Light or dark can be pinned or left to follow the system; the whole overlay scales
  from 90% to 130% for anyone who finds it small. "Follow the system" is settled in the
  renderer rather than in a media query, so the light palette is written once instead
  of twice.

- **Five themes carried over from VS Code** — Tokyo Night, One Dark Pro, Dracula, Nord
  and GitHub — each with a light face and a dark one, so ten palettes in all. A theme
  now writes the surfaces and the text as well as the accent; the translucent tints
  derive from `--text` with `color-mix`, which is what keeps ten palettes down to
  eight declarations of overlay each rather than eighty.

- **Three fonts to pick from.** The bundled Cairo and Inter stay the default; Readex Pro
  is the alternative, and the third choice hands the interface back to the platform's
  own font. Choosing one swaps `--sans` and nothing else, so the type ramp holds.

- **A list you can search, and tick more than one of.** `src/renderer/select.js`
  replaces the platform's dropdown across settings. It does single and multiple, shows
  a colour beside an option when there is one, and grows a search box once there are
  eight options or more. The working statuses are a multi-select now instead of a wall
  of chips, and the theme is a list of names, each with a two-tone swatch that shows the
  palette's background against its accent.

- **Every size comes from one place.** A token layer built on Apple's macOS type ramp
  from the Human Interface Guidelines — title2 17 down to footnote 10 — with spacing on
  the 4pt grid. Twelve font sizes became six, nine corner radii became five, and no rule
  writes a pixel value by hand any more. Themes stay colour-only, so the sizes hold
  across all of them.

- **Cairo, Inter and Readex Pro ship with the app**, 133KB of variable woff2 between
  them, so Arabic and Latin read the same on every platform. All three are SIL OFL, and
  Apple's SF is deliberately absent: its licence covers Apple platforms only. The CSP
  gains `font-src 'self'`, without which no font file would have loaded at all.

- **The board was rebuilt to the new design.** The task list is no longer one flat run of
  rows. It groups under النهاردة / متأخرة / جاي / من غير معاد with a count on each header,
  and every row now carries its priority, the time it has left — or how far past its due
  date it is, in red — beside the status it already showed. Its selected row, its ring and
  its timer all take `--accent`, so the board wears whichever theme you picked rather than
  a colour of its own.

- **Two shapes for the list, on `Ctrl L`.** صف واحد keeps a task to a single line; سطرين
  gives the title its own line and puts the key, type, board and priority underneath it,
  with the status as a pill. The pair of icons next to the board filter switches between
  them, and the choice is remembered.

- **A board filter, on `Ctrl B`.** The dropdown beside the filter chips lists the boards
  your own tasks are actually on — built from what is already loaded, so it costs no
  request — and narrows the list to one of them. Remembered like the view.

- **A side panel next to the list.** Three cards: how much of today is done, as a ring;
  the task in your hands, with its progress and the timer under it; and the shortcuts.
  It hides itself under 1140px, where there is no room for it.

- **The timer starts itself.** There is nothing to press: a task is timed from the moment
  Jira says it entered In Progress — `statuscategorychangedate`, which is already on the
  board — so the count is right even when the overlay was closed the whole time. While it
  is still inside its estimate the side panel counts up and says what time it should close
  by; once it goes past, the reading flips to `+42m` in red, the line under it becomes
  كان المفروض تقفل, and the bar turns red with it. The row carries the same number, without
  the second line.

### Changed

- **Light or dark is three buttons, not a dropdown** — screen, sun, moon — so the
  choices are visible without opening anything. Each is a real radio inside its label,
  so arrow keys and focus come from the browser.

- **The nudge and auto-start checkboxes are switches.** The inputs are still there,
  hidden inside the label, so every listener and `.checked` read is untouched.

- **The sidebar icons are redrawn** on a 24px grid with an even 2px stroke. They were on
  a 16px grid at 1.4px, which is what made them look soft.

- **Messages float instead of shoving the panel.** “اتعملت”, “اتحفظ”, a failed action and
  a lost connection were three strips wedged between the search box and the list, so every
  one of them pushed the tasks down the moment it appeared and pulled them back up eight
  seconds later. They are now one stack of cards floating clear of the panel at the bottom
  of the screen, each with an icon for what it is, and a failure still closes on a click.
  Form feedback did not move — a validation message belongs beside the field it is about,
  not in a corner.

### Fixed

- **The filters say what their shortcut is.** They already answered to Alt+1 through
  Alt+4 and nothing anywhere said so, which is the same as not having it. Each chip
  prints its own key now, the way the quick-date chips in the compose form always have.

- **Tab reaches the work days.** They were spans with a click handler, so the keyboard
  went straight past them. Each day is a real checkbox inside its label now, and carries
  its full name as a tooltip so a single letter is not the only clue.

- **Focus survives a save.** Ticking a day repainted every setting, rebuilding all seven
  days from scratch and dropping focus to the body mid-keystroke — with a keyboard the
  row was unusable after the first tick. The same fault closed the multi-select after
  every tick and destroyed the search box under the cursor. Both now build once and
  update in place.

- **A long answer no longer crushes the label beside it.** Several statuses stretched the
  control past its 260px basis and squeezed the label column until it wrapped one word
  per line. A flex item's default `min-width: auto` refuses to go below its content;
  `min-width: 0` lets the declared width hold.
## [0.7.0] - 2026-09-03

### Added

- **Linux.** `src/main/platform/linux.js` fills in the third adapter, `platform/index.js`
  now names all three explicitly, autostart writes an XDG `.desktop` file into
  `~/.config/autostart`, and `npm run dist:linux` builds an AppImage. Contributed by
  [@AhmedHHamdy](https://github.com/AhmedHHamdy) in
  [#7](https://github.com/Fathi-Mohammed/Tayf/pull/7), tested on Ubuntu 24.04.

  Two things to know before you rely on it. The adapter does not restore focus itself —
  it trusts the window manager to hand focus back once the overlay hides, which is how
  X11 behaves. And a global shortcut is registered by Chromium, which cannot claim one
  under Wayland unless the compositor offers the portal for it; if the hotkey does not
  answer on your session, that is where to look first. The tray needs an AppIndicator
  host — Ubuntu ships one, a plain GNOME does not, and without it there is no icon and
  no way into the settings but the hotkey.

## [0.6.2] - 2026-09-03

### Added

- **The tray says which build you are looking at.** Its first line carries the name and the
  version — طيف 0.6.2 — and a (تطوير) marker when it is `npm start` rather than the installed
  app. Same line in the tooltip, so it is one hover. Two builds that look identical in a
  notification are not identical in the tray any more.

### Fixed

- **A task past the hour is told which quarter it is at.** "Are you still on this?" rounded
  the time down to whole hours, so a ticket that had been running an hour and a quarter, an
  hour and a half, and an hour and three quarters all read بقالها ساعة — three nudges in a
  row that each looked like the last one repeating rather than time passing. It now says
  ساعة وربع, ساعة ونص, ساعتين إلا ربع, and ساعة و20 دقيقة for the minutes that do not land
  on a quarter.
- **A notification comes from طيف, not from Electron.** Windows takes the icon and the name
  above a toast from whichever Start Menu shortcut carries the app's AppUserModelID — and a
  development run was carrying the shipped app's one. Electron rewrites its own
  `Electron.lnk` with that id on every toast, so notifications raised by the installed app
  were being attributed to Electron. `npm start` now runs under its own id and leaves the
  real one to the installed shortcut. The titles no longer start with "طيف —" either: the
  app's name belongs in the header, not in the text.

### Changed

- The Start Menu and desktop shortcut is named **طيف** rather than Tayf, because that name
  is exactly what Windows prints above every notification. Searching the Start Menu for
  `tayf` will not find it after the next install — search for طيف.

## [0.6.1] - 2026-09-02

### Fixed

- **A task handed to the testers no longer counts as work in your hands.** Jira files nine
  of this board's statuses under `indeterminate`, and Tayf trusted the bucket — so Ready
  For Testing and Testing In Progress read as "you are working on this". The result was the
  nudge that matters most never firing: with five tickets sitting in test, Tayf never said
  "nothing is In Progress, go pick something up", and it kept asking whether you were still
  on a ticket that was somebody else's. Which statuses mean the ticket is yours is now a
  setting; name none and it falls back to trusting Jira as before. A passed due date still
  nudges whoever is holding it.
- The **شغال عليها** filter in the list was reading the same bucket, and now follows the
  same setting.

### Changed

- "Nothing is In Progress" counts what you could actually start, rather than everything that
  is not closed, and stays quiet when there is nothing to start at all.

## [0.6.0] - 2026-09-02

### Added

- **Nudges.** Tayf now tells you when the board has drifted from the work. Three of them:
  nothing is In Progress while you are clearly at the machine; a task has been In Progress
  long enough that it is worth asking whether you are still on it; or a task's due date has
  come and gone and it is still open. Clicking a nudge opens the list so the fix is one
  keystroke away. The behaviour is the one written down in [docs/nudges.md](docs/nudges.md),
  and the policy itself is a pure function in `src/app/nudges.js` with 24 tests covering
  every case where it must stay quiet.
- A **النكزات** section in settings for all of it: on/off, how often, how long without a
  keystroke counts as away, working hours, working days, how often to ask whether you are
  still on a task (and whether to ask at all), and how long a task may run past its date
  before it earns a nudge (and whether to nudge about late tasks at all).
- **`npm run try-nudge`**, so a nudge can be tested without waiting for the clock. It runs
  the real policy against the real settings and the cached board, prints which gate is
  closed and how every task looks to it, and with `--anyway` or `--all` shows the actual
  toast. It is what tells a policy that is quiet on purpose apart from a notification
  Windows swallowed.
- **Snooze**, in the tray: an hour, until tomorrow morning, or back on. Without it the
  system would be hostile, and a hostile reminder gets switched off for good.
- `categoryChangedAt` on work items, from Jira's `statuscategorychangedate`. It rides
  along on the list request that already runs, and it is what makes "in progress since"
  mean something — `updated` moves whenever anyone touches the issue.

### Fixed

- **A rejected create now says what Jira wanted.** Jira answers a bad create with `400`
  and a list of the fields it is missing, but every `400` was collapsed into "Jira رجّع
  رد مش متوقع" and the list was dropped on the floor — so a task that would not save gave
  no way to find out why. The reason is now read out of `errorMessages` and `errors` and
  shown with the failure: *Jira رفض الطلب: Field Bug Source is required · Field Bugs Type
  is required · Field Description is required*. Transitions and edits get the same
  treatment, since they fail the same way. The captured response body also grew from 160
  to 600 characters, because a three-field rejection did not fit in 160.

## [0.5.0] - 2026-09-02

### Changed

- **The overlay is right-to-left.** The interface has always been Arabic but the document
  was not marked `dir="rtl"`, so the layout ran left-to-right with Arabic text inside it:
  the accent rail on the wrong edge of a row, the issue key on the wrong side, the action
  menu opening away from the text. The handful of `left`/`right` rules are now logical
  properties, so a future English build flips back by changing one attribute.

### Added

- The settings screen has a sidebar — **الاتصال** and **عام** — reachable with `Ctrl+1`
  and `Ctrl+2` or by clicking, with each preference on its own row: name and explanation
  on one side, the control on the other. The general section holds the two hotkeys and
  start-with-the-machine, which until now could only be changed from the tray menu. Those
  save the moment you change them; the connection section still saves on `Enter` because
  it verifies the credentials first. If a hotkey turns out to be taken by another program,
  the screen says so and shows the one that was registered instead.
- [docs/nudges.md](docs/nudges.md) — the agreed behaviour of the nudge system, written
  down before any of it is built.

## [0.4.1] - 2026-09-02

### Changed

- The Windows tray icon is the app logo (`assets/tray.png`, with an `@2x` for HiDPI)
  instead of the three-bar glyph, so the icon by the clock matches the one on the
  shortcut. macOS keeps its monochrome `trayTemplate` — the menu bar requires a template
  image, and a coloured one cannot be tinted for light and dark.

## [0.4.0] - 2026-09-01

### Added

- An application icon (`build/icon.png`, 1024×1024). electron-builder derives the `.ico`
  and `.icns` from it, so it is what shows on the installer, the Start Menu shortcut and
  the Dock. The tray glyph in `assets/` is unrelated and unchanged.
- Automatic updates on Windows. Tayf checks on start and every four hours, downloads in
  the background, and offers **تحديث جاهز — سطّبه دلوقتي** in the tray menu. Nothing is
  installed until you ask for it, or until the app next quits.
- A release workflow. Pushing a `v*` tag builds Windows and macOS and uploads the
  artifacts to a draft GitHub Release.

### Changed

- The Windows build is an NSIS installer (`Tayf-Setup-<version>.exe`) instead of a
  portable `Tayf.exe`. Automatic updates do not work with portable builds. It installs
  per user, needs no administrator rights, and leaves `%APPDATA%\Tayf\` alone when
  uninstalled, so settings and credentials survive.

### Known limitations

- macOS does not update itself. Squirrel refuses to update an unsigned app and the mac
  build sets `identity: null`, so the `.dmg` on the release page stays a manual
  download. Signing it later also means adding a `zip` target — macOS updates are served
  from the zip, not the dmg.
- Windows shows a SmartScreen warning on first install because the installer is
  unsigned. Updates after that are unaffected; they are verified by checksum.

## [0.2.0] - 2026-09-01

- Overlay over any app on `Ctrl+Space`, quick task creation on `Ctrl+Shift+Space`.
- Actions on a task: view, edit, change status, open in Jira, copy key.
- Windows and macOS. Restructured into layers and published under MIT.
