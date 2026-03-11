import { describe, expect, it, vi } from "vitest";
import { runtimeChannel } from "@/lib/runtime/channel";

describe("runtimeChannel", () => {
  it("publishes latent updates to subscribers", () => {
    const handler = vi.fn();
    const unsubscribe = runtimeChannel.subscribeLatent(handler);

    runtimeChannel.publishLatent({
      latent: { x: 10, y: 20, spin: 0.4 },
      timestamp: 123,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      latent: { x: 10, y: 20, spin: 0.4 },
      timestamp: 123,
    });

    unsubscribe();
  });

  it("stops receiving updates after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = runtimeChannel.subscribeLatent(handler);
    unsubscribe();

    runtimeChannel.publishLatent({
      latent: { x: 1, y: 2, spin: 0.1 },
      timestamp: 456,
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
