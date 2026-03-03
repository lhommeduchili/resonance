/**
 * WebRTC Signal Transport Utilities
 *
 * Pure functions for serializing outbound signals and dispatching inbound
 * signals to an RTCPeerConnection. No React state — only WebRTC operations.
 */

import type { NostrSignaler } from "./nostrSignal";
import type { SignalPayload } from "../types";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Outbound: serialize and emit signals
// ---------------------------------------------------------------------------

/**
 * Serialize an RTCIceCandidate into a typed SignalPayload and emit it
 * over the Nostr network to the given target peer.
 *
 * Normalizes the candidate via `.toJSON()` at the send boundary so the
 * receiving side always gets a plain `RTCIceCandidateInit` object.
 */
export function emitCandidate(
    signaler: NostrSignaler,
    targetPublicKey: string,
    candidate: RTCIceCandidate,
): void {
    signaler.sendSignal(targetPublicKey, {
        type: "candidate" as const,
        candidate: candidate.toJSON(),
    });
}

/**
 * Emit an SDP offer or answer as a properly typed SignalPayload.
 */
export function emitDescription(
    signaler: NostrSignaler,
    targetPublicKey: string,
    description: RTCSessionDescriptionInit,
): void {
    // Offers/answers are critical — send immediately, don't queue.
    signaler.sendSignalImmediate(targetPublicKey, {
        type: description.type as "offer" | "answer",
        sdp: description.sdp ?? "",
    });
}

// ---------------------------------------------------------------------------
// Inbound: dispatch a received signal to a peer connection
// ---------------------------------------------------------------------------

/**
 * Apply a received SignalPayload to the given RTCPeerConnection.
 *
 * - Offers/answers → `setRemoteDescription`
 * - Candidates → `addIceCandidate`
 *
 * Returns a descriptive string for structured logging.
 * Throws on failure — callers should handle errors at the hook level.
 */
export async function applyRemoteSignal(
    pc: RTCPeerConnection,
    signal: SignalPayload,
): Promise<string> {
    switch (signal.type) {
        case "offer":
        case "answer":
            await pc.setRemoteDescription({ type: signal.type, sdp: signal.sdp });
            return `Applied remote ${signal.type}`;

        case "candidate":
            await pc.addIceCandidate(signal.candidate);
            return "Applied ICE candidate";

        case "batch":
            let count = 0;
            for (const s of signal.signals) {
                await applyRemoteSignal(pc, s);
                count++;
            }
            return `Applied batch of ${count} signals`;

        default: {
            const _exhaustive: never = signal;
            logger.warn("SignalTransport", "Unknown signal type received:", _exhaustive);
            return "Unknown signal type";
        }
    }
}
