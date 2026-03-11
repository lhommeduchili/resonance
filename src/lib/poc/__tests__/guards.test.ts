import { describe, expect, it } from "vitest";
import { isPocAttributionEnvelope } from "@/lib/poc/guards";

describe("isPocAttributionEnvelope", () => {
  it("accepts valid attribution payload", () => {
    expect(
      isPocAttributionEnvelope({
        type: "broadcast_started",
        timestamp: Date.now(),
        source: "broadcaster",
        payload: {
          broadcasterId: "npub-root",
          graphId: "graph-x",
          graphName: "Andes",
        },
      }),
    ).toBe(true);
  });

  it("rejects malformed payload", () => {
    expect(
      isPocAttributionEnvelope({
        type: "unknown",
        timestamp: "now",
        payload: null,
      }),
    ).toBe(false);
  });
});
