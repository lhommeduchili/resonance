import { describe, it, expect } from 'vitest';
import { calculateRetentionScore, calculateDiscoveryImpact } from '@/lib/poc/metrics';

describe('Proof of Curation (PoC) Metrics', () => {
    describe('calculateRetentionScore', () => {
        it('returns 0 for no valid sessions', () => {
            expect(calculateRetentionScore([])).toBe(0);
        });

        it('filters out bounces (sessions strictly less than 30s)', () => {
            const now = new Date();
            const sessions = [
                { joinedAt: new Date(now.getTime() - 29000), leftAt: now }, // 29s
                { joinedAt: new Date(now.getTime() - 25000), leftAt: now }, // 25s
            ];
            // All filtered out
            expect(calculateRetentionScore(sessions, now)).toBe(0);
        });

        it('calculates average with a 3-hour strictly enforced cap', () => {
            const now = new Date();
            const sessions = [
                // 1 hour
                { joinedAt: new Date(now.getTime() - 1000 * 60 * 60), leftAt: now },
                // 6 hours (should be capped at 3 hours: 10800 seconds)
                { joinedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6), leftAt: now },
            ];
            const score = calculateRetentionScore(sessions, now);
            // (3600s + 10800s) / 2 = 7200s
            expect(score).toBe(7200);
        });

        it('applies exponential time decay based on a 30-day half-life', () => {
            const now = new Date();
            // Session ended precisely 30 days ago.
            const thirtyDaysAgoEnd = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
            // Joined 1000 seconds before it ended
            const thirtyDaysAgo = new Date(thirtyDaysAgoEnd.getTime() - 1000 * 1000);

            // Session from right now. It lasted 1000 seconds.
            const modernStart = new Date(now.getTime() - 1000 * 1000);

            const sessions = [
                { joinedAt: thirtyDaysAgo, leftAt: thirtyDaysAgoEnd },
                { joinedAt: modernStart, leftAt: now }
            ];

            const score = calculateRetentionScore(sessions, now);

            // Decay Weight Math:
            // modern session age = 0, weight = 1.0, weighted duration = 1000
            // 30 days ago age = 30 days, weight = 0.5, weighted duration = 500
            // Sum Weighted Duration: 1500
            // Sum Weights: 1.5
            // Average: 1500 / 1.5 = 1000
            expect(score).toBeCloseTo(1000, 1);
        });

        it('handles a mix of capped, decayed, and filtered data simultaneously', () => {
            const now = new Date();

            // Ended exactly 30 days ago.
            const thirtyDaysAgoEnd = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
            // Joined 10 hours before it ended.
            const thirtyDaysAgoJoined = new Date(thirtyDaysAgoEnd.getTime() - 1000 * 60 * 60 * 10);

            const sessions = [
                // Bounce: 10 seconds right now (Ignored entirely)
                { joinedAt: new Date(now.getTime() - 10000), leftAt: now },

                // Ended 30 days ago, 10 hours long. 
                // Cap -> 10800s. 
                // Weight -> 0.5. 
                // Weighted component: 5400.
                { joinedAt: thirtyDaysAgoJoined, leftAt: thirtyDaysAgoEnd },

                // Today, exactly 1 hour (3600s).
                // Cap -> 3600s.
                // Weight -> 1.0.
                // Weighted component: 3600.
                { joinedAt: new Date(now.getTime() - 1000 * 60 * 60), leftAt: now }
            ];

            // Sum of weighted = 5400 + 3600 = 9000
            // Sum of weights = 0.5 + 1.0 = 1.5
            // Expected returning value = 9000 / 1.5 = 6000
            const score = calculateRetentionScore(sessions, now);

            expect(score).toBeCloseTo(6000, 1);
        });
    });

    describe('calculateDiscoveryImpact', () => {
        it('returns unique listener count ignoring exact session length for MVP', () => {
            const sessions = [
                { listenerId: '0xAlice' },
                { listenerId: '0xBob' },
                { listenerId: '0xAlice' }, // Rejoined
            ];
            expect(calculateDiscoveryImpact(sessions)).toBe(2);
        });
    });
});
