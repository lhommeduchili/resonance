/**
 * WebRTC Signal Transport Utilities
 *
 * Pure functions for serializing outbound signals and dispatching inbound
 * signals to an RTCPeerConnection. No React state — only WebRTC operations.
 */

import type { Socket } from "socket.io-client";
import type { SignalPayload } from "../types";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Outbound: serialize and emit signals
// ---------------------------------------------------------------------------

/**
 * Serialize an RTCIceCandidate into a typed SignalPayload and emit it
 * over the socket to the given target peer.
 *
 * Normalizes the candidate via `.toJSON()` at the send boundary so the
 * receiving side always gets a plain `RTCIceCandidateInit` object.
 */
export function emitCandidate(
    socket: Socket,
    target: string,
    candidate: RTCIceCandidate,
): void {
    socket.emit("signal", {
        target,
        signal: {
            type: "candidate" as const,
            candidate: candidate.toJSON(),
        },
    });
}

/**
 * Emit an SDP offer or answer as a properly typed SignalPayload.
 */
export function emitDescription(
    socket: Socket,
    target: string,
    description: RTCSessionDescriptionInit,
): void {
    socket.emit("signal", {
        target,
        signal: {
            type: description.type as "offer" | "answer",
            sdp: description.sdp ?? "",
        },
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

        default: {
            const _exhaustive: never = signal;
            logger.warn("SignalTransport", "Unknown signal type received:", _exhaustive);
            return "Unknown signal type";
        }
    }
}
