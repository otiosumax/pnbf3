import fs from "node:fs";
import path from "node:path";

type AppConfig = {
  mode?: string;
  port?: number;
  trustedOrigins?: string[];
  rateLimits?: {
    readPerMinute?: number;
    writePerMinute?: number;
  };
};

type FullConfig = {
  app: AppConfig;
};

type Args = {
  [key: string]: string;
};

export function parseArgs(argv: string[]) {
  const res: Args = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const s = arg.slice(2);
    const i = s.indexOf("=");
    if (i < 0) continue;
    const key = s.slice(0, i);
    const value = s.slice(i + 1);
    res[key] = value;
  }
  return res;
}

export function readFileConfig(filePath: string): FullConfig {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as FullConfig;
}

export function buildConfig({
  fileCfg,
  env,
  args,
}: {
  fileCfg: FullConfig;
  env: Record<string, string | undefined>;
  args: Args;
}): FullConfig {
  const cfg: FullConfig = structuredClone(fileCfg ?? { app: {} });
  const app = cfg.app;

  if (env.APP_MODE) app.mode = env.APP_MODE;
  if (env.APP_PORT) app.port = Number(env.APP_PORT);
  if (env.APP_TRUSTED_ORIGINS)
    app.trustedOrigins = env.APP_TRUSTED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  if (env.APP_READ_PER_MINUTE)
    app.rateLimits = {
      ...(app.rateLimits ?? {}),
      readPerMinute: Number(env.APP_READ_PER_MINUTE),
    };
  if (env.APP_WRITE_PER_MINUTE)
    app.rateLimits = {
      ...(app.rateLimits ?? {}),
      writePerMinute: Number(env.APP_WRITE_PER_MINUTE),
    };

  if (args.mode) app.mode = args.mode;
  if (args.port) app.port = Number(args.port);
  if (args.trustedOrigins)
    app.trustedOrigins = String(args.trustedOrigins)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  if (args.readPerMinute)
    app.rateLimits = {
      ...(app.rateLimits ?? {}),
      readPerMinute: Number(args.readPerMinute),
    };
  if (args.writePerMinute)
    app.rateLimits = {
      ...(app.rateLimits ?? {}),
      writePerMinute: Number(args.writePerMinute),
    };

  return cfg;
}

export function validateConfig(cfg: FullConfig): string[] {
  const errors: string[] = [];
  const app = cfg.app ?? {};

  const mode = String(app.mode ?? "").toLowerCase();
  if (mode !== "учебный" && mode !== "боевой") {
    errors.push("Режим работы задан неверно, допустимы учебный и боевой");
  }

  const port = Number(app.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push(
      "Порт задан неверно, значение должно быть целым числом от 1 до 65535",
    );
  }

  const origins = Array.isArray(app.trustedOrigins) ? app.trustedOrigins : [];
  if (origins.length === 0) {
    errors.push(
      "Список доверенных источников пуст, служба не может быть открыта без ограничений",
    );
  }
  for (const o of origins) {
    try {
      const u = new URL(o);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        errors.push(
          `Доверенный источник должен иметь схему http или https, значение ${o}`,
        );
      }
    } catch {
      errors.push(`Доверенный источник задан неверно, значение ${o}`);
    }
  }

  const rl = app.rateLimits ?? {};
  const read = Number(rl.readPerMinute);
  const write = Number(rl.writePerMinute);

  if (!Number.isInteger(read) || read <= 0)
    errors.push("Лимит чтения должен быть больше нуля");
  if (!Number.isInteger(write) || write <= 0)
    errors.push("Лимит записи должен быть больше нуля");
  if (Number.isInteger(read) && Number.isInteger(write) && write > read)
    errors.push("Лимит записи не должен быть выше лимита чтения");

  return errors;
}

export function getMode(cfg: FullConfig): string {
  return String(cfg.app?.mode ?? "учебный").toLowerCase();
}

export function getTrustedOrigins(cfg: FullConfig): string[] {
  return (cfg.app?.trustedOrigins ?? []).map((x) => String(x));
}

export function getRateLimits(cfg: FullConfig): {
  readPerMinute: number;
  writePerMinute: number;
} {
  return {
    readPerMinute: Number(cfg.app?.rateLimits?.readPerMinute ?? 60),
    writePerMinute: Number(cfg.app?.rateLimits?.writePerMinute ?? 20),
  };
}

export function getPort(cfg: FullConfig): number {
  return Number(cfg.app?.port ?? 3000);
}

export function resolveConfigFromThreeSources({
  configPath,
  env,
  argv,
}: {
  configPath: string;
  env: Record<string, string | undefined>;
  argv: string[];
}): FullConfig {
  const fileCfg = readFileConfig(configPath);
  const args = parseArgs(argv);
  const cfg = buildConfig({ fileCfg, env, args });
  return cfg;
}

export function defaultConfigPath(): string {
  return path.resolve(process.cwd(), "config", "appsettings.json");
}
