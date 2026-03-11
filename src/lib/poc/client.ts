import { logger } from "@/lib/logger";
import type { ResonanceEventEnvelope } from "@/lib/eventBus";
import type { PocAttributionEnvelope } from "@/lib/poc/events";
import { browserIdentity } from "@/lib/auth/identityProvider";

const POC_EVENT_TYPES = new Set<string>([
  "broadcast_started",
  "broadcast_ended",
  "listener_joined",
  "listener_left",
]);

const POC_ENDPOINT = process.env.NEXT_PUBLIC_POC_EVENT_ENDPOINT;

export function toPocAttributionEvent(
  event: ResonanceEventEnvelope,
): PocAttributionEnvelope | null {
  if (!POC_EVENT_TYPES.has(event.type)) {
    return null;
  }

  return {
    type: event.type,
    timestamp: event.timestamp,
    source: event.source,
    payload: event.payload,
  } as PocAttributionEnvelope;
}

export async function sendPocAttributionEvent(event: PocAttributionEnvelope): Promise<void> {
  if (!POC_ENDPOINT) {
    logger.debug(
      "PoC-Attribution",
      "No NEXT_PUBLIC_POC_EVENT_ENDPOINT configured; skipping remote handoff",
      event,
    );
    return;
  }

  try {
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(JSON.stringify(event));
    const signature = await browserIdentity.sign(payloadBytes);
    
    // In a real implementation this would be grouped into a signed envelope wrapper
    // For now we mutate the headers to fulfill the contract constraint logic.
    await fetch(POC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-resonance-signature": JSON.stringify(signature),
        "x-resonance-pubkey": browserIdentity.getUserId(),
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    logger.warn("PoC-Attribution", "Failed to send attribution event", error);
  }
}
