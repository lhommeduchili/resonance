"use client";

import { useEffect, useRef, useState } from "react";
import type { ListenerStatus } from "@/lib/types";

export function useNetworkTelemetry(
    upstreamPcRef: React.MutableRefObject<RTCPeerConnection | null>,
    status: ListenerStatus
) {
    // 1.0 = Perfect. > 1.0 = High Jitter/Loss.
    const [dataTransferRate, setDataTransferRate] = useState<number>(1.0);

    // Store previous metrics to calculate precise deltas (per interval)
    const prevStatsRef = useRef({
        timestamp: 0,
        packetsReceived: 0,
        packetsLost: 0,
    });

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (status === "LISTENING") {
            // Setup polling for the WebRTC Stats
            interval = setInterval(async () => {
                const pc = upstreamPcRef.current;
                if (!pc) return;

                try {
                    const stats = await pc.getStats();
                    // Scrape for the primary inbound RTP stream (audio route)
                    const inboundReport = Array.from(stats.values()).find(
                        (report) => report.type === "inbound-rtp" && report.kind === "audio"
                    );
                    const inboundStats = inboundReport ? inboundReport as { timestamp: number, packetsReceived?: number, packetsLost?: number, jitter?: number } : null;

                    if (inboundStats) {
                        const prev = prevStatsRef.current;
                        const now = inboundStats.timestamp;
                        const packetsReceived = inboundStats.packetsReceived || 0;
                        const packetsLost = inboundStats.packetsLost || 0;
                        const jitter = inboundStats.jitter || 0; // seconds

                        // Only analyze if this isn't the first snapshot
                        if (prev.timestamp > 0 && now > prev.timestamp) {
                            const receivedDelta = packetsReceived - prev.packetsReceived;
                            const lostDelta = packetsLost - prev.packetsLost;
                            const totalDelta = receivedDelta + lostDelta;

                            let lossRatio = 0;
                            if (totalDelta > 0) {
                                lossRatio = lostDelta / totalDelta;
                            }

                            // Weighting algorithm:
                            // Baseline is 1.0 (smooth).
                            // Jitter is highly chaotic. Convert from seconds to ms (e.g. 0.05s = 50ms)
                            // Packet loss is structural. 5% loss is high impact.

                            // Normal jitter is < 0.02s. Let's scale heavily if it exceeds this.
                            const jitterStress = Math.max(0, (jitter * 1000) / 20) * 0.5;

                            // Normal loss is ~0. 5% = 0.05. Scale multiplier. 
                            const lossStress = Math.max(0, lossRatio) * 10.0;

                            const compositeStress = 1.0 + jitterStress + lossStress;

                            // We clamp it so the canvas physics don't completely explode or crash Firefox
                            const clampedStress = Math.min(5.0, compositeStress);

                            setDataTransferRate(clampedStress);
                        }

                        // Store current generation for next diff
                        prevStatsRef.current = {
                            timestamp: now,
                            packetsReceived,
                            packetsLost,
                        };
                    }
                } catch (e) {
                    console.warn("[Telemetry] Failed to gather WebRTC stats: ", e);
                }
            }, 250); // Analyze 4 times a second
        } else {
            // Reset to clean state when ambient or disconnected
            setTimeout(() => setDataTransferRate(1.0), 0);
            prevStatsRef.current = {
                timestamp: 0,
                packetsReceived: 0,
                packetsLost: 0,
            };
        }

        return () => clearInterval(interval);
    }, [status, upstreamPcRef]);

    return { dataTransferRate };
}
