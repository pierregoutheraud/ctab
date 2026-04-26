// Simulates the Chrome extension's offscreen-doc client end of the protocol.
// Used for end-to-end testing the CLI without loading the real extension.

import { DEFAULT_PORT } from "../shared/protocol";

const port = Number(process.env["TABLI_PORT"]) || DEFAULT_PORT;
const lastFocusedAt = Number(process.env["FAKE_LAST_FOCUSED_AT"]) || Date.now();
const currentlyFocused = process.env["FAKE_CURRENTLY_FOCUSED"] !== "false";
const mode = process.env["FAKE_MODE"] || "ok";

// 1x1 transparent PNG, base64-encoded.
const FAKE_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const ws = new WebSocket(`ws://127.0.0.1:${port}/`, {
  headers: { Origin: "chrome-extension://fakefakefakefakefakefakefakefake" },
});

ws.addEventListener("open", () => {
  ws.send(
    JSON.stringify({ type: "hello", lastFocusedAt, currentlyFocused }),
  );
});

ws.addEventListener("message", (event: MessageEvent) => {
  const data = typeof event.data === "string" ? event.data : "";
  let msg: unknown;
  try {
    msg = JSON.parse(data);
  } catch {
    return;
  }
  if (typeof msg !== "object" || msg === null) return;
  const type = (msg as { type?: unknown }).type;
  if (type !== "capture") return;

  if (mode === "error") {
    ws.send(JSON.stringify({ type: "error", message: "fake restricted page" }));
  } else if (mode === "drop") {
    ws.close();
  } else {
    ws.send(JSON.stringify({ type: "captureResult", png: FAKE_PNG_B64 }));
  }
});

ws.addEventListener("close", () => {
  process.exit(0);
});

ws.addEventListener("error", (e) => {
  console.error("fake-extension error:", e);
  process.exit(1);
});

setTimeout(() => process.exit(0), 30_000);
