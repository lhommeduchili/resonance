import { beforeEach, describe, expect, it, vi } from "vitest";
import { handlePocAttributionEvent } from "@/lib/poc/serverEvents";

vi.mock("@/lib/poc/pipeline", () => ({
  startBroadcast: vi.fn(async () => "broadcast-100"),
  endBroadcast: vi.fn(async () => {}),
  recordListenerJoin: vi.fn(async () => "session-200"),
  recordListenerLeave: vi.fn(async () => {}),
  getActiveBroadcastForNode: vi.fn(async () => "broadcast-100"),
  closeOpenSessionsForBroadcast: vi.fn(async () => {}),
  closeOpenSessionsForListener: vi.fn(async () => {}),
}));

import {
  endBroadcast,
  recordListenerJoin,
  startBroadcast,
  getActiveBroadcastForNode,
  closeOpenSessionsForBroadcast,
  closeOpenSessionsForListener,
} from "@/lib/poc/pipeline";

describe("handlePocAttributionEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts and ends broadcasts via pipeline, triggering session cascade", async () => {
    await handlePocAttributionEvent({
      type: "broadcast_started",
      source: "broadcaster",
      timestamp: Date.now(),
      payload: { broadcasterId: "npub-root", graphId: "graph-x", graphName: "Andes" },
    });

    // Validates startBroadcast doesn't rely on in-memory state anymore
    expect(startBroadcast).toHaveBeenCalledWith("graph-x", "npub-root");

    await handlePocAttributionEvent({
      type: "broadcast_ended",
      source: "broadcaster",
      timestamp: Date.now(),
      payload: { broadcasterId: "npub-root" },
    });

    expect(getActiveBroadcastForNode).toHaveBeenCalledWith("npub-root");
    expect(closeOpenSessionsForBroadcast).toHaveBeenCalledWith("broadcast-100");
    expect(endBroadcast).toHaveBeenCalledWith("broadcast-100");
  });

  it("records listener join and leave by querying active broadcasts statelessly", async () => {
    // listener joins
    await handlePocAttributionEvent({
      type: "listener_joined",
      source: "listener",
      timestamp: Date.now(),
      payload: { nodeId: "npub-listener", channelId: "npub-root-2" },
    });

    expect(getActiveBroadcastForNode).toHaveBeenCalledWith("npub-root-2");
    expect(recordListenerJoin).toHaveBeenCalledWith("broadcast-100", "npub-listener");

    // listener leaves
    await handlePocAttributionEvent({
      type: "listener_left",
      source: "listener",
      timestamp: Date.now(),
      payload: { nodeId: "npub-listener" },
    });

    expect(closeOpenSessionsForListener).toHaveBeenCalledWith("npub-listener");
  });
});
