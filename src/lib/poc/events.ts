type PocSource = "listener" | "broadcaster" | "transport" | "ui" | "system";

type PocAttributionBase = {
  timestamp: number;
  source: PocSource;
};

export type PocAttributionEnvelope =
  | (PocAttributionBase & {
      type: "broadcast_started";
      payload: { broadcasterId: string; graphId: string; graphName: string };
    })
  | (PocAttributionBase & {
      type: "broadcast_ended";
      payload: { broadcasterId: string };
    })
  | (PocAttributionBase & {
      type: "listener_joined";
      payload: { nodeId: string; channelId?: string };
    })
  | (PocAttributionBase & {
      type: "listener_left";
      payload: { nodeId: string };
    });
