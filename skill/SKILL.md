---
name: ctab
description: Capture the user's currently active Chrome tab as a PNG and look at it. Use when the user asks "what am I looking at", "look at my tab", "screenshot my browser", or refers to content visible in their Chrome that you'd need to see to answer. Requires the `ctab` CLI and its companion Chrome extension.
license: MIT
metadata:
  author: pierregoutheraud
  version: 0.1.0
---

# ctab — see the user's active Chrome tab

Captures a PNG of whatever tab the user is currently looking at in their **everyday Chrome** — real logins, real profiles, no headless or CDP. Built so you can answer questions about what's on the user's screen.

## When to use

Trigger this skill when the user:

- Asks you to look at their browser ("what am I looking at", "see this tab", "what's on my screen")
- References content visible in Chrome that you'd need a screenshot to understand
- Asks you to screenshot or capture their current tab

## When NOT to use

- **Headless / programmatic browsing** — use `chrome-devtools-mcp` or similar.
- **Page interaction** (clicking, typing, navigating) — `ctab` only captures, it doesn't drive the page. For interaction, use `claude-in-chrome` or `browsermcp`.
- **Capturing a specific tab by URL or ID** — `ctab` captures whichever tab is currently active in the most recently focused Chrome window. It can't target a specific tab.

## How to invoke

Two-step flow:

1. Run `ctab screenshot`. The CLI prints the absolute path of the written PNG to stdout, single line.
2. Use `Read` on that path to view the image.

```sh
ctab screenshot
# → /tmp/ctab-1714137600000.png
```

Then `Read("/tmp/ctab-1714137600000.png")` to see the screenshot, and answer the user's question based on it.

## Errors and fixes

If `ctab screenshot` exits non-zero, the stderr message tells you what went wrong:

| Stderr message | Cause | What to do |
|---|---|---|
| `No Chrome extension responded within 5s` | Extension not loaded, or Chrome not running | Tell the user to run `ctab setup` and load the extension in `chrome://extensions` |
| `Cannot capture restricted page` (or any extension-forwarded error referencing `chrome://`, devtools, etc.) | Active tab is `chrome://`, devtools, Chrome Web Store, the PDF viewer, or `file://` | Tell the user to switch to a normal `https://` tab and retry |
| `Port 47821 is in use` | Another `ctab screenshot` is mid-flight | Wait a moment and retry. If it persists, ask the user to check for stuck processes |
| `Invalid CTAB_PORT: …` | The `CTAB_PORT` env var is set to a non-numeric value | Tell the user to unset or fix it |

Do not retry on restricted-page errors — they need human action.

## Install (run once on the user's machine)

If `which ctab` returns nothing, the user hasn't installed the CLI yet. Easiest path:

```sh
bunx @httpete/ctab setup            # installs the extension files to ~/.ctab/extension/
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle Developer mode (top right).
3. Click "Load unpacked".
4. Select `~/.ctab/extension/`.

For a permanent install (CLI on `$PATH`):

```sh
git clone https://github.com/pierregoutheraud/tabli && cd tabli
bun install
bun run build:ext
bun run install:cli       # ~/.bun/bin/ctab
```

Then load `extension/dist/` in `chrome://extensions` as above.

## Notes

- macOS only as of v0.1.0.
- Multi-profile-aware: if the user has Work + Personal Chrome windows open in parallel (and the extension installed in both), `ctab` automatically picks the most recently focused profile. No configuration needed.
- The PNG is always the **viewport only** — content below the fold is not captured. If the user wants the full page, tell them to scroll first and run `ctab screenshot` again on the new viewport.
