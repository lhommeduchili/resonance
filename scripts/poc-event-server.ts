import { createServer } from "node:http";
import { logger } from "@/lib/logger";
import { isPocAttributionEnvelope } from "@/lib/poc/guards";
import { handlePocAttributionEvent } from "@/lib/poc/serverEvents";

const port = Number(process.env.POC_EVENT_PORT ?? 4010);
const host = process.env.POC_EVENT_HOST ?? "127.0.0.1";

function writeJson(
  res: import("node:http").ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (!req.url || req.url !== "/events") {
    writeJson(res, 404, { ok: false, error: "Not Found" });
    return;
  }

  if (req.method === "OPTIONS") {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  try {
    const raw = Buffer.concat(chunks).toString("utf-8");
    const payload = JSON.parse(raw) as unknown;

    if (!isPocAttributionEnvelope(payload)) {
      writeJson(res, 400, { ok: false, error: "Invalid payload" });
      return;
    }

    await handlePocAttributionEvent(payload);
    writeJson(res, 200, { ok: true });
  } catch (error) {
    logger.error("PoC-Attribution", "Failed to process incoming event", error);
    writeJson(res, 500, { ok: false, error: "Internal Server Error" });
  }
});

server.listen(port, host, () => {
  logger.info(
    "PoC-Attribution",
    `PoC event server listening on http://${host}:${port}/events`,
  );
});
