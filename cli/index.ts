#!/usr/bin/env bun
import { runScreenshot } from "./screenshot";
import { runSetup } from "./setup";

function printUsage(): void {
  process.stdout.write(`ctab — interact with your active Chrome tab.

Usage:
  ctab screenshot [output-path]    Capture the active tab to a PNG.
  ctab setup                       Install the companion Chrome extension.
  ctab help                        Show this message.

Output path defaults to /tmp/ctab-<unix-ms>.png.

Environment:
  CTAB_PORT   Override localhost port (default: 47821)
`);
}

const sub = process.argv[2];
const arg = process.argv[3];

switch (sub) {
  case "screenshot":
    await runScreenshot(arg);
    break;
  case "setup":
    await runSetup();
    break;
  case undefined:
  case "help":
  case "--help":
  case "-h":
    printUsage();
    process.exit(sub === undefined ? 1 : 0);
  default:
    console.error(`unknown subcommand: ${sub}\n`);
    printUsage();
    process.exit(1);
}
