import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

function findExtensionDist(): string | null {
  const candidates: string[] = [];

  // 1. Relative to this script (works when running from cloned repo or bunx cache).
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolvePath(here, "..", "extension", "dist"));
    candidates.push(resolvePath(here, "..", "..", "extension", "dist"));
  } catch {
    // import.meta.url may be unavailable in some bundled contexts; fall through.
  }

  // 2. Relative to the entry script (process.argv[1]).
  if (process.argv[1]) {
    const argv1Dir = dirname(process.argv[1]);
    candidates.push(resolvePath(argv1Dir, "..", "extension", "dist"));
    candidates.push(resolvePath(argv1Dir, "..", "..", "extension", "dist"));
  }

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "manifest.json"))) {
      return candidate;
    }
  }
  return null;
}

export async function runSetup(): Promise<never> {
  const target = join(homedir(), ".ctab", "extension");
  const source = findExtensionDist();

  if (!source) {
    console.error(
      "Could not locate the bundled extension files.\n" +
        "If you're running from a cloned repo, run `bun run build:ext` first, then load\n" +
        "`extension/dist/` directly in chrome://extensions.",
    );
    process.exit(1);
  }

  try {
    await mkdir(dirname(target), { recursive: true });
    if (existsSync(target)) {
      await rm(target, { recursive: true, force: true });
    }
    await cp(source, target, { recursive: true });
  } catch (e) {
    console.error(
      `Failed to install extension files to ${target}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `Extension files installed at: ${target}\n` +
      `\n` +
      `Now load it in Chrome:\n` +
      `  1. Open chrome://extensions\n` +
      `  2. Toggle Developer mode (top right)\n` +
      `  3. Click "Load unpacked"\n` +
      `  4. Select: ${target}\n` +
      `\n` +
      `After loading, run \`ctab screenshot\` to verify.\n`,
  );
  process.exit(0);
}
