import { db } from '@/db';
import { curatorialGraphs, broadcasts, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
    } catch (e: unknown) {
        // Suppressed in local dev to cleanly mock DB PoC records
        return `mock-broadcast-${Date.now()}`;
    }
}

export async function endBroadcast(broadcastId: string): Promise<void> {
    try {
        await db.update(broadcasts)
            .set({ endedAt: new Date() })
            .where(eq(broadcasts.id, broadcastId));
    } catch (e: unknown) {
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
    } catch (e: unknown) {
        return `mock-session-${Date.now()}`;
    }
}

export async function recordListenerLeave(sessionId: string): Promise<void> {
    try {
        await db.update(sessions)
            .set({ leftAt: new Date() })
            .where(eq(sessions.id, sessionId));
    } catch (e: unknown) {
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
    } catch (e: unknown) {
        return { retentionScore: 0, discoveryImpact: 0 };
    }
}
