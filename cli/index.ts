#!/usr/bin/env bun
import { runScreenshot } from "./screenshot";

function printUsage(): void {
  process.stdout.write(`tabli — interact with your active Chrome tab.

Usage:
  tabli screenshot [output-path]    Capture the active tab to a PNG.
  tabli help                        Show this message.

Output path defaults to /tmp/tabli-<unix-ms>.png.

Environment:
  TABLI_PORT   Override localhost port (default: 47821)
`);
}

const sub = process.argv[2];
const arg = process.argv[3];

switch (sub) {
  case "screenshot":
    await runScreenshot(arg);
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
