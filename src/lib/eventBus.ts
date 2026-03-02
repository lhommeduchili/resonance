export type EventPayloads = {
    listener_joined: { nodeId: string; channelId?: string };
    listener_left: { nodeId: string };
    relay_selected: { parentNodeId: string };
    broadcast_started: { broadcasterId: string };
    broadcast_ended: { broadcasterId: string };
    curation_support_changed: { amount: number; target: string };
    audio_profile_changed: { profile: string };
};

export type EventCallback<T extends keyof EventPayloads> = (payload: EventPayloads[T]) => void;

export class ResonanceEventBus {
    private listeners: {
        [K in keyof EventPayloads]?: Set<EventCallback<K>>;
    } = {};

    on<T extends keyof EventPayloads>(event: T, callback: EventCallback<T>): void {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set<EventCallback<T>>() as typeof this.listeners[T];
        }
        this.listeners[event]!.add(callback);
    }

    off<T extends keyof EventPayloads>(event: T, callback: EventCallback<T>): void {
        if (this.listeners[event]) {
            this.listeners[event]!.delete(callback);
        }
    }

    emit<T extends keyof EventPayloads>(event: T, payload: EventPayloads[T]): void {
        if (this.listeners[event]) {
            for (const callback of this.listeners[event]!) {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[EventBus] Error executing listener for event ${event}:`, error);
                }
            }
        }
    }
}

// Global singleton instance for use across the application
export const eventBus = new ResonanceEventBus();
