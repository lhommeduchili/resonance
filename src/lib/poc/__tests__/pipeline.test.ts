import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pipeline from '../pipeline';
import { db } from '@/db';
import * as schema from '@/db/schema';

// Mock the drizzle DB
vi.mock('@/db', () => ({
    db: {
        insert: vi.fn(),
        update: vi.fn(),
        select: vi.fn(),
    }
}));

describe('Session Attribution Scoring Pipeline (DAL)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('startBroadcast should insert a broadcast record and return the ID', async () => {
        const mockDbValues = vi.fn().mockReturnThis();
        const mockDbReturning = vi.fn().mockResolvedValue([{ id: 'broadcast-123' }]);

        (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            values: mockDbValues.mockImplementation(() => ({
                returning: mockDbReturning
            }))
        }));

        const result = await pipeline.startBroadcast('graph-1', '0xBroadcaster');

        expect(db.insert).toHaveBeenCalledWith(schema.broadcasts);
        expect(mockDbValues).toHaveBeenCalledWith({
            graphId: 'graph-1',
            broadcasterWallet: '0xBroadcaster'
        });
        expect(result).toBe('broadcast-123');
    });

    it('recordListenerJoin should insert a session record and return the ID', async () => {
        const mockDbValues = vi.fn().mockReturnThis();
        const mockDbReturning = vi.fn().mockResolvedValue([{ id: 'session-456' }]);

        (db.insert as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            values: mockDbValues.mockImplementation(() => ({
                returning: mockDbReturning
            }))
        }));

        const result = await pipeline.recordListenerJoin('broadcast-1', '0xListener');

        expect(db.insert).toHaveBeenCalledWith(schema.sessions);
        expect(mockDbValues).toHaveBeenCalledWith({
            broadcastId: 'broadcast-1',
            listenerId: '0xListener'
        });
        expect(result).toBe('session-456');
    });
});
