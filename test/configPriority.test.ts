import test from "node:test";
import assert from "node:assert/strict";
import { buildConfig, validateConfig } from "../src/config.ts";

test("Приоритет источников настроек работает как заявлено", () => {
  const fileCfg = { app: { rateLimits: { readPerMinute: 10 } } };
  const env = { APP_READ_PER_MINUTE: "20" };
  const args = { readPerMinute: "30" };

  const cfg = buildConfig({ fileCfg, env, args });
  assert.equal(cfg.app.rateLimits?.readPerMinute ?? 0, 30);
});

test("Некорректные настройки дают ошибки проверки", () => {
  const cfg = {
    app: {
      mode: "x",
      port: 0,
      trustedOrigins: [],
      rateLimits: { readPerMinute: 0, writePerMinute: 0 },
    },
  };
  const errors = validateConfig(cfg);
  assert.ok(errors.length >= 3);
});
