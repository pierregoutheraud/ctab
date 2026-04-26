# tabli

A Bun CLI + Chrome extension that captures the **active tab in your everyday Chrome** (real logins, real profiles — not headless, not CDP) and writes a PNG to disk. Built for feeding LLM coding agents a snapshot of what you're looking at.

See `DECISIONS.md` for the architecture rationale and rejected alternatives.

## Install (one-time)

Requires [Bun](https://bun.sh) 1.3+ and macOS.

### 1. Build and load the extension

```sh
bun install
bun run build:ext
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select `extension/dist/` from this repo.

The extension runs in the background — no popup, no UI. It silently maintains a localhost connection waiting for the CLI.

### 2. Get the `tabli` command on your `$PATH`

```sh
bun run install:cli
```

This builds a ~60MB self-contained binary and drops it in `~/.bun/bin/tabli` (which Bun's installer already adds to your `$PATH`). No Bun needed at runtime after that. Re-run after code changes. To remove: `bun run uninstall:cli`.

If you'd rather symlink the source (skip the rebuild step on every change):

```sh
chmod +x cli/index.ts
ln -s "$PWD/cli/index.ts" ~/.bun/bin/tabli
```

## Usage

```sh
tabli screenshot                  # writes /tmp/tabli-<ms>.png, prints path
tabli screenshot ./shot.png       # writes to ./shot.png
tabli help                        # show usage
```

Stdout: absolute path of the written PNG, single line. Errors go to stderr; exit 1 on failure.

Capture-and-open in one shot:

```fish
open (tabli screenshot)             # fish
```
```bash
open "$(tabli screenshot)"          # bash/zsh
```

## Options

| | |
|---|---|
| Positional arg to `screenshot` | output path (default: `/tmp/tabli-<unix-ms>.png`) |
| `TABLI_PORT` | override the localhost port (default: `47821`) |

## Limitations

- macOS only (Bun + MV3 work elsewhere; just untested).
- Cannot capture restricted pages: `chrome://`, devtools, Chrome Web Store, the PDF viewer, `file://`. Switch to a normal tab and retry.
- `captureVisibleTab` returns the **viewport only** — content below the fold is not captured. (Full-page capture is on the deferred list in `DECISIONS.md`.)
- If you run multiple Chrome profiles in parallel, install the extension in each. The CLI auto-picks the most recently focused profile.

## Troubleshooting

**`No Chrome extension responded within 5s`** — Chrome isn't running, or the extension isn't loaded. Check `chrome://extensions`.

**`Cannot capture restricted page`** — switch to a normal `https://` tab.

**`Port 47821 is in use`** — another `tabli screenshot` is mid-flight, or the port is taken. Wait a moment, or set `TABLI_PORT`.
