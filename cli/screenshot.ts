import { resolve as resolvePath } from "node:path";
import type { Server, ServerWebSocket } from "bun";
import {
  CONNECTION_TIMEOUT_MS,
  DEFAULT_PORT,
  HELLO_COLLECTION_WINDOW_MS,
} from "../shared/protocol";
import type { ExtToCli, Hello } from "../shared/protocol";

type ClientData = { hello: Hello | null };

export async function runScreenshot(outputArg: string | undefined): Promise<never> {
  const portEnv = process.env["CTAB_PORT"];
  const port = portEnv ? Number(portEnv) : DEFAULT_PORT;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    console.error(`Invalid CTAB_PORT: ${portEnv}`);
    process.exit(1);
  }

  const outputPath = outputArg
    ? resolvePath(outputArg)
    : `/tmp/ctab-${Date.now()}.png`;

  let done = false;
  let chosen: ServerWebSocket<ClientData> | null = null;
  let collectionTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let server: Server<ClientData> | null = null;
  const clients = new Set<ServerWebSocket<ClientData>>();

  const shutdown = (): void => {
    if (collectionTimer) clearTimeout(collectionTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
    try {
      server?.stop(true);
    } catch {
      // best-effort
    }
  };

  const exitOk = (path: string): never => {
    if (!done) {
      done = true;
      console.log(path);
      shutdown();
    }
    process.exit(0);
  };

  const exitErr = (msg: string, code = 1): never => {
    if (!done) {
      done = true;
      console.error(msg);
      shutdown();
    }
    process.exit(code);
  };

  const pickByLastFocused = (): ServerWebSocket<ClientData> | null => {
    let best: ServerWebSocket<ClientData> | null = null;
    let bestTime = -Infinity;
    for (const ws of clients) {
      const hello = ws.data.hello;
      if (!hello) continue;
      if (hello.lastFocusedAt > bestTime) {
        bestTime = hello.lastFocusedAt;
        best = ws;
      }
    }
    return best;
  };

  const chooseAndCapture = (ws: ServerWebSocket<ClientData>): void => {
    if (chosen) return;
    chosen = ws;
    if (collectionTimer) {
      clearTimeout(collectionTimer);
      collectionTimer = null;
    }
    for (const other of clients) {
      if (other !== ws) {
        try {
          other.close();
        } catch {
          // best-effort
        }
      }
    }
    ws.send(JSON.stringify({ type: "capture" }));
  };

  const tryFinalize = (): void => {
    if (chosen) return;
    for (const ws of clients) {
      if (ws.data.hello?.currentlyFocused === true) {
        chooseAndCapture(ws);
        return;
      }
    }
    if (!collectionTimer) {
      collectionTimer = setTimeout(() => {
        if (chosen) return;
        const winner = pickByLastFocused();
        if (winner) chooseAndCapture(winner);
      }, HELLO_COLLECTION_WINDOW_MS);
    }
  };

  const writeAndExit = async (base64Png: string): Promise<void> => {
    try {
      const bytes = Uint8Array.from(atob(base64Png), (c) => c.charCodeAt(0));
      await Bun.write(outputPath, bytes);
      exitOk(outputPath);
    } catch (e) {
      exitErr(
        `Failed to write screenshot to ${outputPath}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  };

  timeoutTimer = setTimeout(() => {
    exitErr(
      "No Chrome extension responded within 5s.\n" +
        "Make sure Chrome is running and the ctab bridge extension is loaded.\n" +
        "Run `ctab setup` to install the extension, then load it in chrome://extensions.",
    );
  }, CONNECTION_TIMEOUT_MS);

  try {
    server = Bun.serve<ClientData>({
      hostname: "127.0.0.1",
      port,
      fetch(req, srv) {
        const origin = req.headers.get("origin") ?? "";
        if (!origin.startsWith("chrome-extension://")) {
          return new Response("forbidden origin", { status: 403 });
        }
        const upgraded = srv.upgrade(req, { data: { hello: null } });
        if (upgraded) return undefined;
        return new Response("expected websocket upgrade", { status: 426 });
      },
      websocket: {
        open(ws) {
          clients.add(ws);
        },
        message(ws, data) {
          const raw = typeof data === "string" ? data : new TextDecoder().decode(data);
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            return;
          }
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            !("type" in parsed)
          ) {
            return;
          }
          const msg = parsed as ExtToCli;
          if (msg.type === "hello") {
            ws.data.hello = msg;
            tryFinalize();
          } else if (msg.type === "captureResult") {
            if (ws !== chosen) return;
            void writeAndExit(msg.png);
          } else if (msg.type === "error") {
            if (ws !== chosen) return;
            exitErr(msg.message);
          }
        },
        close(ws) {
          clients.delete(ws);
          if (ws === chosen && !done) {
            exitErr("Chrome extension disconnected before sending the screenshot.");
          }
        },
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    const portInUse =
      lower.includes("eaddrinuse") ||
      lower.includes("address already in use") ||
      (lower.includes("port") && lower.includes("in use"));
    if (portInUse) {
      console.error(
        `Port ${port} is in use. Another ctab screenshot may be in flight, ` +
          `or another process owns the port.\n` +
          `Override with: CTAB_PORT=<port> ctab screenshot`,
      );
      process.exit(1);
    }
    console.error(`Failed to start server: ${msg}`);
    process.exit(1);
  }

  return await new Promise<never>(() => {
    // The exit functions above will terminate the process. This await holds
    // the function open while the WS event loop drives the state machine.
  });
}
