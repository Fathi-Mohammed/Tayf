# Jira and platform quirks

*[بالعربي](jira-quirks.ar.md)*

Things that cost real debugging time. Each one explains why some piece of the code
looks stranger than it should. **Read this before "simplifying" the code it describes.**

---

## Jira Cloud

### Jira lies about `required`

`/issue/createmeta/.../issuetypes/{id}` reports `required: false` for fields the
workflow will then reject the issue for. The observed case was a `Task Type`
dropdown: `required: false`, and creating without it failed.

**What the code does:** `metadata.js → fetchCreateFields` returns *every* custom
option field with allowed values, not just the required ones, and the UI shows them
all. We do not trust the flag.

Do not "optimise" this by filtering on `required`.

### `Σ Time Spent` is never in the transition fields

Some workflows refuse a transition unless work has been logged, but `Σ Time Spent`
is a computed field. It does not appear in `GET /issue/{key}/transitions?expand=…`,
so there is no way to know in advance that the transition needs it.

**What the code does:**

1. Ask for time when it is *likely* needed — the item is in progress, has no logged
   work, and is moving to something other than "to do".
2. When Jira rejects a transition with a message matching `/time\s*spent/i`, remember
   `PROJECT:transitionId` in `transitionsNeedingWorklog` (persisted in the cache) and
   ask for time next time before even trying.
3. Log the work *first* with `POST /worklog`, then transition. The field fills itself.

See `workspace.js → applyTransition` and `transitions.js → needsWorklog`.

### Planning fields are not on the transition screen either

Start date, due date, original estimate, and custom "due"-like fields (e.g.
`Development due date`) are frequently required by a workflow to start work, but do
not appear in the transition's field list.

**What the code does:** `transitions.js → loadRequiredFields` reads the item plus its
create-meta, works out which planning fields are still empty, and asks for them.
`applyTransition` saves them with `PUT /issue/{key}` **before** posting the transition.

### Response keys are not what you would guess

`/issue/createmeta/{project}/issuetypes` returns the list under **`issueTypes`**, not
`values`, even though sibling endpoints use `values`. The code reads
`response.issueTypes || response.values` for that reason.

### The search endpoint moved

`/rest/api/3/search` is being replaced by `/rest/api/3/search/jql` (token pagination
instead of `startAt`). `issues.js → fetchAssignedItems` tries the new one and falls
back to the old one on `404`/`410`.

### Boards filter by JQL, and one project can have several

A project often has several boards, each filtering with a different clause. Real
example:

| Board | Filter clause | What an issue needs to appear |
|---|---|---|
| `FPE - Tech` | `labels != "React" AND "Task Type" != "UI Task"` | nothing — this is the default |
| `FPE - React` | `labels in (React)` | `Labels = React` |
| `FPE - Product Design` | `"Task Type[Dropdown]" = "UI Task"` | `Task Type = UI Task` |

**What the code does:** `jql.js` parses the board's filter and keeps only the
**inclusive** clauses (`=` and single-value `in`). Negations mean "leave it empty",
which is already the default, so they are ignored. `boards.js → fieldValueToPayload`
converts each clause to the right API shape for that field's schema.

This is deliberately conservative: anything it cannot read confidently it reports in
`unreadableClauses` rather than guessing. The compose screen shows the user what will
be set *before* they create the issue.

### Which board is an item on? Ask Jira, don't compute it

The parser above is for *creating*; it ignores complex clauses on purpose. To display
which boards an item appears on, `mapItemsToBoards` queries each board's issues
directly — the board's own filter is applied server-side, so what comes back is exactly
what the user sees on that board.

Two gotchas: Scrum boards do not return backlog items from `/board/{id}/issue`
(a second call to `/board/{id}/backlog` is needed), and the same item can come back
from both — hence the `Set`.

### Descriptions are ADF, not text

`description` is an Atlassian Document Format tree. `mappers.js` converts both ways
so the neutral `WorkItem` carries plain text. **ADF must not leak past `providers/`.**

### An image in a comment is not the attachment you just uploaded

`POST /issue/{key}/attachments` gives you an attachment id (`73496`). The `media` node
inside a comment wants a **Media Services UUID** (`b1ccce6b-…`), and no public REST
endpoint hands that UUID out — not the upload response, not `GET /attachment/{id}`.
Sending `{"type":"file","id":"<attachment id>"}` is rejected with
`ATTACHMENT_VALIDATION_ERROR`.

What Jira does accept is external media pointing back at the attachment:

```json
{ "type": "media", "attrs": { "type": "external",
  "url": "https://<site>/rest/api/3/attachment/content/73496" } }
```

So `attachments.js` uploads the file and `rich-text.js` writes that node. Reading is the
other direction: a `file` media node carries the filename in `alt`, so it is matched
against the issue's attachment list to find a URL worth fetching.

### A task list needs ids Jira will not generate for you

`taskList` and every `taskItem` inside it need a `localId`. Without them the whole
document is rejected. `rich-text.js` generates UUIDs for both.

### Rate limits

Jira Cloud returns `429` with `Retry-After` under a cost-based system. The client
surfaces this as the `rate-limited` code. There is no backoff yet — see the issues
list if you want to add one.

---

## Windows

### Hiding a window does not restore focus

On Windows, `win.hide()` does not return focus to whatever was in front. Without
handling this, the user is dumped on the desktop after every use — which defeats the
entire point of the tool.

**What the code does:** `platform/windows.js` stores the overlay's own `HWND`, calls
`GetForegroundWindow()` before showing (skipping itself), and `SetForegroundWindow()`
after hiding. This needs `koffi` to reach `user32.dll`.

### The portable build cannot relaunch itself

The portable `.exe` unpacks into a temp directory, so `app.relaunch()` restarts the
temp copy. `platform/windows.js → relaunchCommand` returns
`process.env.PORTABLE_EXECUTABLE_FILE`, which electron-builder sets to the real
`.exe` path, and `relaunch.js` spawns that instead.

### The tray icon does not adapt

Windows does not recolour tray icons for you. Two files are shipped
(`tray-on-dark.png`, `tray-on-light.png`) and `nativeTheme.shouldUseDarkColors`
picks one, re-picking when the system theme changes.

---

## macOS

### Focus works completely differently

There is no `HWND` to capture. macOS restores focus by itself — but only if the whole
**application** hides, not just the window. So `restoreFocus()` calls `app.hide()`,
and `focusOverlayApp()` calls `app.show()` + `app.focus({ steal: true })` before
showing again, otherwise the window appears without keyboard focus.

### `setBounds` is ignored on a non-resizable window

The overlay is `resizable: false`, and macOS then ignores `setBounds`, leaving the
window at its default size. `platform/macos.js → setOverlayBounds` toggles
`setResizable(true)` around the call.

### Full-screen apps need a panel

To float above an app in full screen, the window must be `type: 'panel'`.

### `Ctrl+Space` is taken

It switches keyboard layout on macOS, and `Cmd+Space` is Spotlight. The default there
is `Option+Space`.

### The tray icon is a template

macOS wants a black-with-alpha "template" image and inverts it itself.
`trayTemplate.png` and `trayTemplate@2x.png` exist for this;
`image.setTemplateImage(true)` is what activates the behaviour.

---

## The renderer

### Keyboard shortcuts read the physical key, not the character

With an Arabic keyboard layout, pressing `E` produces `ث`, so `event.key` is useless
for shortcuts. `keyboard.js → physicalKey` reads `event.code` (`KeyE`, `Digit1`,
`Numpad1`), which is layout-independent.

### Late responses must not overwrite fresh ones

Board, type and field lookups are chained, and a slow earlier response can land after
a newer one. Every load path takes a `requestId` from a counter and bails out if the
counter has moved on. Removing those guards produces the "fields from the previous
project" bug.

### Inline `style` attributes are blocked

The renderer runs under `default-src 'none'; script-src 'self'`, which blocks `style`
attributes in generated HTML. Use a class. `element.style.x = …` from JavaScript is
fine — CSP does not apply to CSSOM.
