import { DEFAULT_PORT } from "../shared/protocol";
import type { CliToExt, ExtToCli } from "../shared/protocol";

const PORT = DEFAULT_PORT;
const RECONNECT_BACKOFF_MS = 500;

type FocusStateResponse = { lastFocusedAt: number; currentlyFocused: boolean };
type CaptureResponse = { png: string } | { error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFocusState(): Promise<FocusStateResponse> {
  return chrome.runtime.sendMessage({ type: "getFocusState" }) as Promise<FocusStateResponse>;
}

async function doCapture(): Promise<CaptureResponse> {
  return chrome.runtime.sendMessage({ type: "doCapture" }) as Promise<CaptureResponse>;
}

function send(ws: WebSocket, msg: ExtToCli): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function parseMessage(raw: string): CliToExt | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      (parsed as { type: unknown }).type === "capture"
    ) {
      return { type: "capture" };
    }
  } catch {
    // fall through
  }
  return null;
}

async function connectAndServe(): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    } catch {
      finish();
      return;
    }

    ws.addEventListener("open", () => {
      void (async () => {
        try {
          const state = await getFocusState();
          send(ws, { type: "hello", ...state });
        } catch (e) {
          send(ws, {
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
          ws.close();
        }
      })();
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      const data = typeof event.data === "string" ? event.data : "";
      const msg = parseMessage(data);
      if (msg === null) return;
      if (msg.type === "capture") {
        void (async () => {
          const result = await doCapture();
          if ("png" in result) {
            send(ws, { type: "captureResult", png: result.png });
          } else {
            send(ws, { type: "error", message: result.error });
          }
        })();
      }
    });

    ws.addEventListener("close", finish);
    ws.addEventListener("error", finish);
  });
}

async function main(): Promise<void> {
  while (true) {
    await connectAndServe();
    await sleep(RECONNECT_BACKOFF_MS);
  }
}

void main();
