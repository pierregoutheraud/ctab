type FocusState = {
  lastFocusedAt: number;
  currentlyFocused: boolean;
};

type BackgroundRequest =
  | { type: "getFocusState" }
  | { type: "doCapture" };

type CaptureResponse = { png: string } | { error: string };

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length > 0) return;

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: "Maintain a persistent localhost WebSocket connection to the tabli CLI.",
    });
  } catch (e) {
    if (!String(e).includes("Only a single offscreen document")) {
      console.warn("[tabli] ensureOffscreen failed:", e);
    }
  }
}

async function readPersistedFocus(): Promise<FocusState> {
  const stored = await chrome.storage.session.get(["lastFocusedAt", "currentlyFocused"]);
  return {
    lastFocusedAt: typeof stored["lastFocusedAt"] === "number" ? stored["lastFocusedAt"] : 0,
    currentlyFocused: stored["currentlyFocused"] === true,
  };
}

async function getFocusState(): Promise<FocusState> {
  const persisted = await readPersistedFocus();
  try {
    const win = await chrome.windows.getLastFocused();
    if (win.focused) {
      const now = Date.now();
      void chrome.storage.session.set({ lastFocusedAt: now, currentlyFocused: true });
      return { lastFocusedAt: now, currentlyFocused: true };
    }
    return { lastFocusedAt: persisted.lastFocusedAt, currentlyFocused: false };
  } catch {
    return persisted;
  }
}

async function doCapture(): Promise<CaptureResponse> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
    const prefix = "data:image/png;base64,";
    const base64 = dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : dataUrl;
    return { png: base64 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureOffscreen();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureOffscreen();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  const focused = windowId !== chrome.windows.WINDOW_ID_NONE;
  if (focused) {
    void chrome.storage.session.set({
      lastFocusedAt: Date.now(),
      currentlyFocused: true,
    });
  } else {
    void chrome.storage.session.set({ currentlyFocused: false });
  }
  void ensureOffscreen();
});

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  if (message.type === "getFocusState") {
    getFocusState().then(sendResponse);
    return true;
  }
  if (message.type === "doCapture") {
    doCapture().then(sendResponse);
    return true;
  }
  return false;
});

void ensureOffscreen();
