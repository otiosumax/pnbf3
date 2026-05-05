import test from "node:test";
import assert from "node:assert/strict";
import { IncomingMessage, ServerResponse } from "node:http";
import { applyCors, createRateLimiter } from "../src/security.ts";

test("Недоверенный источник не получает разрешающий заголовок", () => {
  const req: Partial<IncomingMessage> = {
    headers: { origin: "http://evil.local" },
  };
  const headers = new Map<string, string>();
  const res: Partial<ServerResponse> = {
    setHeader(
      this: ServerResponse,
      k: string,
      v: string | string[],
    ): ServerResponse {
      headers.set(k, String(v));
      return this as ServerResponse;
    },
  };

  applyCors(req as IncomingMessage, res as ServerResponse, [
    "http://localhost:5173",
  ]);
  assert.equal(headers.has("Access-Control-Allow-Origin"), false);
});

test("Ограничитель частоты блокирует лишние запросы", () => {
  const limiter = createRateLimiter({ readPerMinute: 2, writePerMinute: 1 });

  const req: Partial<IncomingMessage> = {
    method: "GET",
    url: "/api/items",
    socket: { remoteAddress: "1.2.3.4" } as any,
    headers: {},
  };

  assert.equal(limiter.allow(req as IncomingMessage), true);
  assert.equal(limiter.allow(req as IncomingMessage), true);
  assert.equal(limiter.allow(req as IncomingMessage), false);
});
