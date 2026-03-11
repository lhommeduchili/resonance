import { logger } from "@/lib/logger";
import {
  endBroadcast,
  recordListenerJoin,
  startBroadcast,
  getActiveBroadcastForNode,
  closeOpenSessionsForBroadcast,
  closeOpenSessionsForListener
} from "@/lib/poc/pipeline";
import type { PocAttributionEnvelope } from "@/lib/poc/events";

function normalizeIdentity(raw: string): string {
  return raw.slice(0, 42);
}

export async function handlePocAttributionEvent(event: PocAttributionEnvelope): Promise<void> {
  switch (event.type) {
    case "broadcast_started": {
      const broadcasterId = normalizeIdentity(event.payload.broadcasterId);
      await startBroadcast(event.payload.graphId, broadcasterId);
      return;
    }

    case "broadcast_ended": {
      const broadcasterId = normalizeIdentity(event.payload.broadcasterId);
      const broadcastId = await getActiveBroadcastForNode(broadcasterId);
      if (!broadcastId) return;

      await closeOpenSessionsForBroadcast(broadcastId);
      await endBroadcast(broadcastId);
      
      return;
    }

    case "listener_joined": {
      const listenerId = normalizeIdentity(event.payload.nodeId);
      const broadcasterNodeId = normalizeIdentity(event.payload.channelId || "");
      if (!broadcasterNodeId) return;

      const broadcastId = await getActiveBroadcastForNode(broadcasterNodeId);
      if (!broadcastId) {
        logger.debug("PoC-Attribution", "No active broadcast for listener join", event.payload);
        return;
      }

      await recordListenerJoin(broadcastId, listenerId);
      return;
    }

    case "listener_left": {
      const listenerId = normalizeIdentity(event.payload.nodeId);
      await closeOpenSessionsForListener(listenerId);
      return;
    }
  }
}
