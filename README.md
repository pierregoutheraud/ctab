# ctab

A Bun CLI + Chrome extension that captures the **active tab in your everyday Chrome** (real logins, real profiles — not headless, not CDP) and writes a PNG to disk. Built for feeding LLM coding agents a snapshot of what you're looking at.

See `DECISIONS.md` for the architecture rationale and rejected alternatives.

## Quick start (no clone, via bunx)

Requires [Bun](https://bun.sh) 1.3+ and macOS.

```sh
bunx @httpete/ctab setup       # installs the extension files to ~/.ctab/extension/
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select `~/.ctab/extension/`.

That's it. Now run:

```sh
bunx @httpete/ctab screenshot              # writes /tmp/ctab-<ms>.png, prints path
bunx @httpete/ctab screenshot ./shot.png   # writes to ./shot.png
```

For a shorter `ctab` invocation, see "Local install" below.

## Local install (CLI on `$PATH`, plus optional Claude Code skill)

```sh
git clone https://github.com/pierregoutheraud/tabli && cd tabli
bun install
```

### 1. Build and load the extension

```sh
bun run build:ext
```

In Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `extension/dist/`.

### 2. Get the `ctab` command on your `$PATH`

```sh
bun run install:cli
```

This builds a ~60MB self-contained binary and drops it in `~/.bun/bin/ctab` (which Bun's installer already adds to your `$PATH`). No Bun needed at runtime after that. Re-run after code changes. To remove: `bun run uninstall:cli`.

If you'd rather symlink the source (skip the rebuild step on every change):

```sh
chmod +x cli/index.ts
ln -s "$PWD/cli/index.ts" ~/.bun/bin/ctab
```

### 3. Install the Claude Code skill (optional)

```sh
bun run install:skill
```

Symlinks `skill/` to `~/.claude/skills/ctab/`. After restarting Claude Code, prompts like *"look at my current tab"* or *"what am I seeing right now?"* will auto-trigger `ctab screenshot` and read the resulting PNG — no need to mention `ctab` by name. To remove: `bun run uninstall:skill`.

## Usage

```sh
ctab screenshot                  # writes /tmp/ctab-<ms>.png, prints path
ctab screenshot ./shot.png       # writes to ./shot.png
ctab setup                       # install/refresh the bundled extension files
ctab help                        # show usage
```

Stdout: absolute path of the written PNG, single line. Errors go to stderr; exit 1 on failure.

Capture-and-open in one shot:

```fish
open (ctab screenshot)             # fish
```
```bash
open "$(ctab screenshot)"          # bash/zsh
```

## Options

| | |
|---|---|
| Positional arg to `screenshot` | output path (default: `/tmp/ctab-<unix-ms>.png`) |
| `CTAB_PORT` | override the localhost port (default: `47821`) |

## Limitations

- macOS only (Bun + MV3 work elsewhere; just untested).
- Cannot capture restricted pages: `chrome://`, devtools, Chrome Web Store, the PDF viewer, `file://`. Switch to a normal tab and retry.
- `captureVisibleTab` returns the **viewport only** — content below the fold is not captured. (Full-page capture is on the deferred list in `DECISIONS.md`.)
- If you run multiple Chrome profiles in parallel, install the extension in each. The CLI auto-picks the most recently focused profile.

## Troubleshooting

**`No Chrome extension responded within 5s`** — Chrome isn't running, or the extension isn't loaded. Run `ctab setup` and load `~/.ctab/extension/` in `chrome://extensions`.

**`Cannot capture restricted page`** — switch to a normal `https://` tab.

**`Port 47821 is in use`** — another `ctab screenshot` is mid-flight, or the port is taken. Wait a moment, or set `CTAB_PORT`.
