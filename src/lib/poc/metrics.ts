// src/lib/poc/metrics.ts

export interface SessionRecord {
    joinedAt?: Date;
    leftAt?: Date | null;
    listenerId?: string;
}

const BOUNCE_THRESHOLD_SECONDS = 30;
const MAX_SESSION_CONTRIBUTION_SECONDS = 10800; // 3 Hours (User adjusted from 4)
const DECAY_HALF_LIFE_DAYS = 30;

/**
 * Calculates the Capped, Filtered, Time-Weighted average retention score.
 * 
 * Cryptoeconomic Rules:
 * 1. Bounce Filtering: Drop sessions under 30s.
 * 2. Session Capping: Max 3 hour contribution to prevent AFK inflation.
 * 3. Exponential Time Decay: 30-day half-life for historical relevance.
 * 
 * @param sessions Array of session objects linking listeners to a broadcast.
 * @param currentTime Optional override for "now" suitable for testing.
 * @returns Average weighted session time in seconds.
 */
export function calculateRetentionScore(
    sessions: SessionRecord[],
    currentTime: Date = new Date()
): number {
    if (!sessions || sessions.length === 0) return 0;

    let totalWeightedSeconds = 0;
    let totalWeights = 0;

    for (const session of sessions) {
        if (!session.joinedAt) continue;

        const end = session.leftAt ? session.leftAt : currentTime;
        const durationSeconds = Math.max(0, (end.getTime() - session.joinedAt.getTime()) / 1000);

        // 1. Bounce Filtering (Noise Reduction)
        if (durationSeconds < BOUNCE_THRESHOLD_SECONDS) {
            continue;
        }

        // 2. Session Capping (Outlier Removal)
        const cappedDuration = Math.min(durationSeconds, MAX_SESSION_CONTRIBUTION_SECONDS);

        // 3. Exponential Time Decay (Relevance)
        // The "age" of the session is from the moment it ended to now.
        const ageMs = currentTime.getTime() - end.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        // If a session ended exactly now, ageDays is 0, making weight = 1.0 (pow(0.5, 0))
        // Math.max(0, ageDays) prevents future dates from gaining >1.0 multiplier
        const weight = Math.pow(0.5, Math.max(0, ageDays) / DECAY_HALF_LIFE_DAYS);

        totalWeightedSeconds += (cappedDuration * weight);
        totalWeights += weight;
    }

    if (totalWeights === 0) return 0;

    return totalWeightedSeconds / totalWeights;
}

/**
 * Calculates the total number of unique listeners exploring a broadcast channel.
 * @param sessions Array of session objects for a broadcast
 * @returns The count of unique listeners
 */
export function calculateDiscoveryImpact(sessions: SessionRecord[]): number {
    if (!sessions || sessions.length === 0) return 0;

    const uniqueListeners = new Set<string>();

    for (const session of sessions) {
        if (session.listenerId) {
            uniqueListeners.add(session.listenerId);
        }
    }

    return uniqueListeners.size;
}
