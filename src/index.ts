import http, { IncomingMessage, ServerResponse } from "node:http";
import {
  defaultConfigPath,
  getMode,
  getPort,
  getRateLimits,
  getTrustedOrigins,
  resolveConfigFromThreeSources,
  validateConfig,
} from "./config.ts";
import createItemsRepo from "./items.ts";
import {
  applyCors,
  applySecurityHeaders,
  createRateLimiter,
} from "./security.ts";

const cfg = resolveConfigFromThreeSources({
  configPath: defaultConfigPath(),
  env: process.env,
  argv: process.argv.slice(2),
});

const errors = validateConfig(cfg);
if (errors.length > 0) {
  console.error("Некорректная конфигурация:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

const mode = getMode(cfg);
const port = getPort(cfg);
const trustedOrigins = getTrustedOrigins(cfg);
const limits = getRateLimits(cfg);
const limiter = createRateLimiter(limits);

const repo = createItemsRepo();

const server = http.createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    applySecurityHeaders(res);
    applyCors(req, res, trustedOrigins);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!limiter.allow(req)) {
      res.statusCode = 429;
      res.setHeader("Content-Type", "text/plain");
      res.end("Слишком много запросов. ");
      return;
    }

    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/api/items") {
        req.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(repo.list()));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/items/by-id") {
        const id = url.pathname.split("/").pop() ?? "";
        const item = repo.get(id);
        if (!item) throw new Error("Товар не найден");
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(item));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/items") {
        const body = await readJson(req);
        const name = String((body as any).name ?? "").trim();
        const price = Number((body as any).price ?? 0);

        if (!name) throw new Error("Название товара не может быть пустым");
        if (!Number.isFinite(price) || price <= 0)
          throw new Error("Цена товара должна быть положительным числом");

        const created = repo.create(name, price);
        res.statusCode = 201;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Location", `/api/items/by-id/${created.id}`);
        res.end(JSON.stringify(created));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/mode") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ mode }));
        return;
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Маршрут не найден");
    } catch (e: unknown) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      const msg =
        mode === "учебный"
          ? String((e as Error)?.message ?? "Ошибка")
          : "Ошибка обработки запроса";
      res.end(msg);
    }
  },
);

server.listen(port, () => {
  console.log(`Служба запущена на порту ${port}`);
});

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf-8");
    req.on("data", (chunk: string) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error("Некорректный JSON"));
      }
    });
  });
}
