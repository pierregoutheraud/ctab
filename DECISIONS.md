# Design decisions and future work

This document records the architectural decisions made before implementation and lists alternatives that were considered but deferred. It's an ADR + roadmap, not user docs.

## Decisions

### 1. Architecture: Bun CLI + Chrome extension over WebSocket

**Decision.** A Bun-powered CLI binary that opens a localhost WebSocket server, paired with a Chrome MV3 extension whose offscreen document acts as a persistent WebSocket client. The extension calls `chrome.tabs.captureVisibleTab()` and sends the PNG back over the socket.

**Why.** This is the only architecture that:
- Works against the user's everyday Chrome (real logins, real cookies, real profiles).
- Doesn't require launching Chrome with `--remote-debugging-port` (which Chrome 136+ blocks for the default profile anyway).
- Exposes a true CLI surface that any tool — agents, scripts, cron jobs — can shell out to.

**Alternatives rejected.**
- *macOS `screencapture` + AppleScript on the frontmost Chrome window.* Captures Chrome chrome (URL bar, tab strip), only works when Chrome is the frontmost OS app, and depends on AppleScript permissions. Simpler but produces a noisier image and a worse UX.
- *Chrome DevTools Protocol (CDP).* Requires launching Chrome with the debug flag every time and a non-default `--user-data-dir` since Chrome 136. Defeats the "use my normal Chrome" requirement.
- *Reuse `claude-in-chrome` (Anthropic's MCP).* Verified empirically that it only sees tabs inside its own MCP-controlled tab group, not the user's real tabs. No CLI surface; closed-source; locked to Claude.
- *Fork `ivoglent/chrome-mcp-bridge`.* Closest existing twin but a 5-commit unmaintained POC. Rebuilding from scratch is the same effort with cleaner ownership.

### 2. CLI lifecycle: one-shot, not daemon

**Decision.** Each `ctab screenshot` invocation spins up the WS server, gets one capture, exits.

**Why.** No "is the daemon running?" failure mode. The extension is doing the "stay reachable" work anyway (see decision 3), so a daemon adds nothing for the LLM-agent-occasional-capture use case. Stateless and easier to reason about.

**Alternative rejected.**
- *Persistent daemon (`ctab start` / `ctab capture`).* Faster on successive captures but creates a setup cliff (forgot to start the daemon → confusing failure). Worth revisiting only if real workloads need bursts of captures per second.

### 3. Extension liveness: offscreen document with persistent retry loop

**Decision.** The extension creates an offscreen document on startup that runs `while (true) { connect; backoff }` against `ws://127.0.0.1:47821`.

**Why.** MV3 service workers go idle after ~30s. `chrome.alarms` has a 30s minimum interval, so a service-worker-based reconnect loop means up to 30s wake-up latency — unusable for "capture now → feed agent." Offscreen documents don't have the SW idle timer; they hold a tiny retry loop with sub-second connect latency when the CLI runs.

**Alternatives rejected.**
- *`chrome.alarms` every 30s.* Worst-case 30s wake-up. Awful for interactive use.
- *Native messaging keepalive.* The open `connectNative` port keeps the SW alive forever. Works, but ditches the WebSocket architecture and requires installing a native messaging manifest under `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` — extra setup with no benefit over offscreen.

### 4. Capture scope: viewport only

**Decision.** v1 captures only what's visible in the tab — exactly what `chrome.tabs.captureVisibleTab()` returns.

**Why.** Matches the dominant use case ("show the agent what I'm looking at"), is one API call, doesn't disturb the user's tab. Full-page scroll-and-stitch mutates page state visibly during capture and adds ~5× the code.

**Alternatives deferred (see §Future improvements).**
- Full-page scroll-and-stitch behind a `--full-page` flag.

### 5. Multi-profile resolution: last-focused profile wins

**Decision.** Each extension reports `lastFocusedAt` and `currentlyFocused` on connect. CLI fast-paths if exactly one client says `currentlyFocused: true`; otherwise waits 100ms after the first hello, picks the client with the largest `lastFocusedAt`.

**Why.** Multiple Chrome profiles can run in parallel, each with its own extension. Without this logic, "first to connect wins" → unpredictable cross-profile results. The fast path makes single-profile users pay zero cost.

**Alternatives rejected.**
- *Single-profile assumption.* Forces the user to install in only one profile or get random captures. Felt restrictive.
- *First-to-connect wins.* Race-condition UX. Predictably wrong about half the time when both profiles are open.

**Cost:** ~50–100ms added latency in the worst case (when nothing in Chrome currently has focus, e.g. when running the CLI from a terminal that's frontmost). Negligible compared to the ~100–300ms `captureVisibleTab` itself.

### 6. Output: `/tmp/ctab-<ms>.png`, path on stdout

**Decision.** Default file location `/tmp/ctab-<unix-ms>.png`. Absolute path on stdout (single line, nothing else). Errors and status on stderr. Optional positional arg overrides the default path. Exit `0`/`1`.

**Why.** macOS auto-cleans `/tmp` after 3 days of disuse → no clutter. Single-line stdout means `ctab screenshot | xargs cat` works. Quiet by default → script-friendly.

**Alternatives rejected.**
- *Default to current directory.* Clutters wherever the agent invokes from.
- *`~/Pictures/ctab/`.* Discoverable but never auto-cleans; would pile up.
- *Print base64 to stdout instead of a path.* Noisy in agent logs; PNGs are large; harder to compose with other tools.

### 7. Auth: bind to 127.0.0.1 + reject non-extension Origins

**Decision.** WS server binds to `127.0.0.1` only (not `0.0.0.0`). On WS upgrade, reject any request whose `Origin` header doesn't start with `chrome-extension://`.

**Why.** Browsers set the `Origin` header reliably on WebSocket upgrades — web pages can't spoof it. This blocks malicious pages on the user's Chrome from connecting and faking a screenshot response. `127.0.0.1` blocks LAN attackers entirely.

**Alternative deferred.** Pinning to a specific extension ID. Possible after we add a `"key"` field to `manifest.json` and capture the ID. Tightens the check from "any chrome-extension" to "this exact extension." See future improvements.

## Future improvements (deferred from v1)

These are intentional non-goals for v1 but worth revisiting when needed:

### Capture options
- **`--full-page` flag.** Scroll the active tab from top to bottom, capture each viewport-sized chunk via `captureVisibleTab`, stitch via OffscreenCanvas, restore scroll position. Watch out for sticky headers (need to hide via `chrome.scripting.executeScript`), lazy-loaded images (force-trigger before capture), and fixed-position elements (would otherwise duplicate in every slice).
- **`--tab-id <id>` / `--url <pattern>`.** Capture a specific tab without focusing it. Requires `tabs.update({active: true})` momentarily, or rely on `captureVisibleTab` quirks.
- **`--format jpeg --quality 80`.** PNG is lossless but big; JPEG would be useful for bandwidth-sensitive consumers.
- **`--region x,y,w,h`.** Crop server-side before writing the PNG.

### Distribution / install UX
- **Chrome Web Store listing.** Currently the extension installs as unpacked (developer mode). Web Store listing makes onboarding one click but adds Google review latency. Worth it only if anyone other than the author uses this.
- **Homebrew formula.** `brew install ctab` instead of `bun install` + symlink.
- **Single-binary build via `bun build --compile`.** Wired up via `bun run install:cli`; produces a self-contained executable. No Bun runtime install needed at runtime.
- **`ctab doctor` subcommand.** Diagnose: extension installed? at least one Chrome window open? port free? Print actionable output.
- **`ctab install-extension` subcommand.** Print the chrome://extensions install steps with the right path filled in.

### Security
- **Pin extension ID via `manifest.json` `"key"`.** Tighten the Origin check from "any chrome-extension" to one specific ID. Stops other installed extensions from racing for connections.
- **HMAC handshake.** Generate a shared token at extension install time, write it to a file the CLI reads, send it in the `hello`. Belt-and-suspenders if pinning the ID isn't enough.

### Reliability
- **Retry on transient capture failures.** `captureVisibleTab` occasionally fails on tab transitions; one retry would cover that.
- **Honor `chrome.system.display` for high-DPI.** Currently `captureVisibleTab` returns the device-pixel image; verify behavior on Retina vs external monitors.

### Cross-platform
- **Linux support.** Bun + MV3 extension already works there; mainly needs install-step docs adjusted.
- **Windows support.** Same — verify path handling for the default `/tmp` equivalent (`%TEMP%`).

### Observability
- **`--verbose` flag.** Print connection lifecycle, chosen profile/window, timing breakdown to stderr.
- **`--metadata` flag.** After the path on stdout, print one line of JSON: `{url, title, width, height, capturedAt}`. Helps the agent understand what it captured. Adds parsing surface, so kept off by default.

### Performance
- **Daemon mode (revisit decision 2).** Only worth it if usage shifts to high-frequency capture (e.g., recording a session as a series of frames). For one-off captures the simplicity of one-shot wins.

### Convenience features
- **Optional clipboard copy.** Mirror the PNG to the macOS clipboard via `osascript` after writing to disk. Convenient for pasting into chat UIs (though agents can't read the clipboard).
- **Optional macOS Quick Look preview after capture.** `qlmanage -p <path>` opens the PNG in QL for human verification.

## Hard non-goals

These are not "deferred" — they're deliberately not on the path:

- **Headless browser support.** That's `chrome-devtools-mcp`'s job.
- **Page interaction (clicking, typing, navigating).** That's `claude-in-chrome` / `browsermcp`. This tool's only job is "give me a PNG of the active tab."
- **Cross-extension messaging / browser automation framework.** Out of scope; would balloon the surface area beyond a CLI.
