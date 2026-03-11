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

        const payload: EventPayloads['broadcast_started'] = {
            broadcasterId: 'root-1',
            graphId: 'graph-1',
            graphName: 'Andes Nocturne',
        };
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

    it('should emit envelope metadata and keep bounded history', () => {
        const envelopeHandler = vi.fn();
        eventBus.onEnvelope('broadcast_started', envelopeHandler);

        eventBus.emit(
            'broadcast_started',
            { broadcasterId: 'root-9', graphId: 'graph-9', graphName: 'Pacific Drift' },
            { source: 'broadcaster' }
        );

        expect(envelopeHandler).toHaveBeenCalledTimes(1);
        const envelope = envelopeHandler.mock.calls[0][0];
        expect(envelope.type).toBe('broadcast_started');
        expect(envelope.source).toBe('broadcaster');
        expect(typeof envelope.timestamp).toBe('number');

        const history = eventBus.getHistoryForEvent('broadcast_started');
        expect(history.length).toBe(1);
        expect(history[0]?.payload).toEqual({
            broadcasterId: 'root-9',
            graphId: 'graph-9',
            graphName: 'Pacific Drift',
        });
    });
});
