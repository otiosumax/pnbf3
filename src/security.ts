import { IncomingMessage, ServerResponse } from "http";

export function applySecurityHeaders(res: ServerResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

export function applyCors(
  req: IncomingMessage,
  res: ServerResponse,
  trustedOrigins: string[] | null,
) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (!trustedOrigins) return;

  if (trustedOrigins?.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Requested-Id",
    );
  }
}

type RateLimitOptions = {
  readPerMinute: number;
  writePerMinute: number;
};

type Bucket = {
  resetAt: number;
  read: number;
  write: number;
};

export function createRateLimiter({
  readPerMinute,
  writePerMinute,
}: RateLimitOptions) {
  const store = new Map<string, Bucket>();

  function keyFromReq(req: IncomingMessage): string {
    const ip = req.socket.remoteAddress ?? "unknown";
    return ip;
  }

  function newBucket(k: string): Bucket {
    const now = Date.now();
    const win = 60_000;
    const item = store.get(k) ?? { resetAt: now + win, read: 0, write: 0 };

    if (now > item.resetAt) {
      item.resetAt = now + win;
      item.read = 0;
      item.write = 0;
    }

    store.set(k, item);
    return item;
  }

  return {
    allow(req: IncomingMessage): boolean {
      const key = keyFromReq(req);
      const bucket = newBucket(key);

      const method = req.method?.toUpperCase() ?? "GET";
      const url = req.url ?? "/";

      const isWrite = method === "POST" && url.startsWith("/api/items");
      const isRead = method === "GET" && url.startsWith("/api/");

      if (isWrite) {
        bucket.write += 1;
        return bucket.write <= writePerMinute;
      }

      if (isRead) {
        bucket.read += 1;
        return bucket.read <= readPerMinute;
      }

      return true;
    },
  };
}
