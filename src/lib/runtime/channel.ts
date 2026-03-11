import type { LatentRuntimeUpdate } from "@/lib/runtime/contracts";

type LatentSubscriber = (update: LatentRuntimeUpdate) => void;

class RuntimeChannel {
  private latentSubscribers = new Set<LatentSubscriber>();

  subscribeLatent(callback: LatentSubscriber): () => void {
    this.latentSubscribers.add(callback);
    return () => {
      this.latentSubscribers.delete(callback);
    };
  }

  publishLatent(update: LatentRuntimeUpdate): void {
    this.latentSubscribers.forEach((callback) => {
      callback(update);
    });
  }
}

export const runtimeChannel = new RuntimeChannel();
