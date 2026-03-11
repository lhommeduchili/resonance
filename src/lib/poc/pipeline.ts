import { db } from '@/db';
import { broadcasts, sessions } from '@/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { calculateDiscoveryImpact, calculateRetentionScore } from './metrics';

export async function startBroadcast(graphId: string, broadcasterWallet: string): Promise<string> {
    try {
        const result = await db.insert(broadcasts)
            .values({
                graphId,
                broadcasterWallet
            })
            .returning({ id: broadcasts.id });

        return result[0].id;
    } catch {
        // Suppressed in local dev to cleanly mock DB PoC records
        return `mock-broadcast-${Date.now()}`;
    }
}

export async function getActiveBroadcastForNode(broadcasterWallet: string): Promise<string | null> {
    try {
        const result = await db.select({ id: broadcasts.id })
            .from(broadcasts)
            .where(and(
                eq(broadcasts.broadcasterWallet, broadcasterWallet),
                isNull(broadcasts.endedAt)
            ))
            .orderBy(desc(broadcasts.startedAt))
            .limit(1);

        return result.length > 0 ? result[0].id : null;
    } catch {
        return null;
    }
}

export async function closeOpenSessionsForBroadcast(broadcastId: string): Promise<void> {
    try {
        await db.update(sessions)
            .set({ leftAt: new Date() })
            .where(and(
                eq(sessions.broadcastId, broadcastId),
                isNull(sessions.leftAt)
            ));
    } catch {
        // Silently catch
    }
}

export async function endBroadcast(broadcastId: string): Promise<void> {
    try {
        await db.update(broadcasts)
            .set({ endedAt: new Date() })
            .where(eq(broadcasts.id, broadcastId));
    } catch {
        // Silently catch to avoid log spam, DB is typically off in dev unless needed
    }
}

export async function recordListenerJoin(broadcastId: string, listenerId: string): Promise<string> {
    try {
        const result = await db.insert(sessions)
            .values({
                broadcastId,
                listenerId
            })
            .returning({ id: sessions.id });

        return result[0].id;
    } catch {
        return `mock-session-${Date.now()}`;
    }
}

export async function getActiveSessionForListener(broadcastId: string, listenerId: string): Promise<string | null> {
    try {
        const result = await db.select({ id: sessions.id })
            .from(sessions)
            .where(and(
                eq(sessions.broadcastId, broadcastId),
                eq(sessions.listenerId, listenerId),
                isNull(sessions.leftAt)
            ))
            .orderBy(desc(sessions.joinedAt))
            .limit(1);

        return result.length > 0 ? result[0].id : null;
    } catch {
        return null;
    }
}

export async function closeOpenSessionsForListener(listenerId: string): Promise<void> {
    try {
        await db.update(sessions)
            .set({ leftAt: new Date() })
            .where(and(
                eq(sessions.listenerId, listenerId),
                isNull(sessions.leftAt)
            ));
    } catch {
        // Silently catch
    }
}

export async function recordListenerLeave(sessionId: string): Promise<void> {
    try {
        await db.update(sessions)
            .set({ leftAt: new Date() })
            .where(eq(sessions.id, sessionId));
    } catch {
        // Silently catch
    }
}

export interface GraphMetrics {
    retentionScore: number;
    discoveryImpact: number;
}

/**
 * Executes an aggregate query to retrieve all sessions associated with a specific Curatorial Graph,
 * and passes them through the pure thermodynamic logic functions.
 */
export async function getGraphMetrics(graphId: string): Promise<GraphMetrics> {
    try {
        // To avoid huge memory spikes, we join broadcasts to sessions
        const result = await db
            .select({
                joinedAt: sessions.joinedAt,
                leftAt: sessions.leftAt,
                listenerId: sessions.listenerId
            })
            .from(sessions)
            .innerJoin(broadcasts, eq(sessions.broadcastId, broadcasts.id))
            .where(eq(broadcasts.graphId, graphId));

        const retention = calculateRetentionScore(result);
        const discovery = calculateDiscoveryImpact(result);

        return {
            retentionScore: retention,
            discoveryImpact: discovery
        };
    } catch {
        return { retentionScore: 0, discoveryImpact: 0 };
    }
}
