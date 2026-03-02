import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResonanceEventBus, EventPayloads } from '../eventBus';

describe('ResonanceEventBus', () => {
    let eventBus: ResonanceEventBus;

    beforeEach(() => {
        eventBus = new ResonanceEventBus();
    });

    it('should allow subscribing to an event and receiving it', () => {
        const mockCallback = vi.fn();
        eventBus.on('listener_joined', mockCallback);

        const payload: EventPayloads['listener_joined'] = { nodeId: 'test-node-123' };
        eventBus.emit('listener_joined', payload);

        expect(mockCallback).toHaveBeenCalledTimes(1);
        expect(mockCallback).toHaveBeenCalledWith(payload);
    });

    it('should allow multiple subscribers to receive the same event', () => {
        const mockCallback1 = vi.fn();
        const mockCallback2 = vi.fn();

        eventBus.on('broadcast_started', mockCallback1);
        eventBus.on('broadcast_started', mockCallback2);

        const payload: EventPayloads['broadcast_started'] = { broadcasterId: 'root-1' };
        eventBus.emit('broadcast_started', payload);

        expect(mockCallback1).toHaveBeenCalledTimes(1);
        expect(mockCallback1).toHaveBeenCalledWith(payload);
        expect(mockCallback2).toHaveBeenCalledTimes(1);
        expect(mockCallback2).toHaveBeenCalledWith(payload);
    });

    it('should stop receiving events after unsubscribing', () => {
        const mockCallback = vi.fn();
        eventBus.on('relay_selected', mockCallback);

        // Unsubscribe
        eventBus.off('relay_selected', mockCallback);

        eventBus.emit('relay_selected', { parentNodeId: 'node-A' });

        expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should only receive events for the subscribed type', () => {
        const mockCallbackJoined = vi.fn();
        const mockCallbackLeft = vi.fn();

        eventBus.on('listener_joined', mockCallbackJoined);
        eventBus.on('listener_left', mockCallbackLeft);

        eventBus.emit('listener_joined', { nodeId: 'node-1' });

        expect(mockCallbackJoined).toHaveBeenCalledTimes(1);
        expect(mockCallbackLeft).not.toHaveBeenCalled();
    });
});
