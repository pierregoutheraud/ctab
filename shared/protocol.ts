export type Hello = {
  type: "hello";
  lastFocusedAt: number;
  currentlyFocused: boolean;
};

export type CaptureResult = {
  type: "captureResult";
  png: string;
};

export type ProtocolError = {
  type: "error";
  message: string;
};

export type ExtToCli = Hello | CaptureResult | ProtocolError;

export type CaptureRequest = { type: "capture" };

export type CliToExt = CaptureRequest;

export const DEFAULT_PORT = 47821;
export const HELLO_COLLECTION_WINDOW_MS = 100;
export const CONNECTION_TIMEOUT_MS = 5000;
