import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "dist");

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(here, "background.ts"), join(here, "offscreen.ts")],
  outdir: distDir,
  target: "browser",
  format: "esm",
  minify: false,
  sourcemap: "none",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

copyFileSync(join(here, "manifest.json"), join(distDir, "manifest.json"));
copyFileSync(join(here, "offscreen.html"), join(distDir, "offscreen.html"));

console.log(`Extension built to: ${distDir}`);
console.log("Load it: chrome://extensions → Developer mode → Load unpacked → select that folder.");
