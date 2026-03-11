import { logger } from "@/lib/logger";

export type EventPayloads = {
  listener_joined: { nodeId: string; channelId?: string };
  listener_left: { nodeId: string };
  relay_selected: { parentNodeId: string };
  broadcast_started: { broadcasterId: string; graphId: string; graphName: string };
  broadcast_ended: { broadcasterId: string };
  curation_support_changed: { amount: number; target: string };
  audio_profile_changed: { profile: string };
};

export type ResonanceEventType = keyof EventPayloads;

export type EventSource =
  | "listener"
  | "broadcaster"
  | "simulation"
  | "transport"
  | "ui"
  | "system";

export type ResonanceEventEnvelope<T extends ResonanceEventType = ResonanceEventType> = {
  type: T;
  timestamp: number;
  source: EventSource;
  payload: EventPayloads[T];
};

export type EventCallback<T extends ResonanceEventType> = (payload: EventPayloads[T]) => void;
export type EventEnvelopeCallback<T extends ResonanceEventType> = (
  event: ResonanceEventEnvelope<T>,
) => void;
export type AnyEventCallback = (event: ResonanceEventEnvelope) => void;

type EmitOptions = {
  source?: EventSource;
};

export class ResonanceEventBus {
  private listeners: {
    [K in ResonanceEventType]?: Set<EventCallback<K>>;
  } = {};

  private envelopeListeners: {
    [K in ResonanceEventType]?: Set<EventEnvelopeCallback<K>>;
  } = {};

  private anyListeners = new Set<AnyEventCallback>();

  private history: ResonanceEventEnvelope[] = [];

  constructor(private readonly maxHistory = 500) {}

  on<T extends ResonanceEventType>(event: T, callback: EventCallback<T>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set<EventCallback<T>>() as typeof this.listeners[T];
    }
    this.listeners[event]?.add(callback);
  }

  onEnvelope<T extends ResonanceEventType>(
    event: T,
    callback: EventEnvelopeCallback<T>,
  ): void {
    if (!this.envelopeListeners[event]) {
      this.envelopeListeners[event] = new Set<EventEnvelopeCallback<T>>() as typeof this.envelopeListeners[T];
    }
    this.envelopeListeners[event]?.add(callback);
  }

  onAny(callback: AnyEventCallback): void {
    this.anyListeners.add(callback);
  }

  off<T extends ResonanceEventType>(event: T, callback: EventCallback<T>): void {
    this.listeners[event]?.delete(callback);
  }

  offEnvelope<T extends ResonanceEventType>(
    event: T,
    callback: EventEnvelopeCallback<T>,
  ): void {
    this.envelopeListeners[event]?.delete(callback);
  }

  offAny(callback: AnyEventCallback): void {
    this.anyListeners.delete(callback);
  }

  emit<T extends ResonanceEventType>(
    event: T,
    payload: EventPayloads[T],
    options: EmitOptions = {},
  ): ResonanceEventEnvelope<T> {
    const envelope: ResonanceEventEnvelope<T> = {
      type: event,
      timestamp: Date.now(),
      source: options.source ?? "ui",
      payload,
    };

    this.pushHistory(envelope);

    this.listeners[event]?.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        logger.error("eventBus", `Payload listener failed for event ${event}`, error);
      }
    });

    this.envelopeListeners[event]?.forEach((callback) => {
      try {
        callback(envelope);
      } catch (error) {
        logger.error("eventBus", `Envelope listener failed for event ${event}`, error);
      }
    });

    this.anyListeners.forEach((callback) => {
      try {
        callback(envelope);
      } catch (error) {
        logger.error("eventBus", `Any-listener failed for event ${event}`, error);
      }
    });

    return envelope;
  }

  getHistory(): readonly ResonanceEventEnvelope[] {
    return this.history;
  }

  getHistoryForEvent<T extends ResonanceEventType>(
    event: T,
  ): readonly ResonanceEventEnvelope<T>[] {
    return this.history.filter(
      (entry): entry is ResonanceEventEnvelope<T> => entry.type === event,
    );
  }

  clearHistory(): void {
    this.history = [];
  }

  private pushHistory(event: ResonanceEventEnvelope): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
  }
}

export const eventBus = new ResonanceEventBus();
