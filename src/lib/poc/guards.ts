import type { PocAttributionEnvelope } from "@/lib/poc/events";

const VALID_TYPES = new Set([
  "broadcast_started",
  "broadcast_ended",
  "listener_joined",
  "listener_left",
]);

export function isPocAttributionEnvelope(value: unknown): value is PocAttributionEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (!VALID_TYPES.has(String(candidate.type))) {
    return false;
  }

  if (typeof candidate.timestamp !== "number") {
    return false;
  }

  if (!candidate.payload || typeof candidate.payload !== "object") {
    return false;
  }

  return true;
}
