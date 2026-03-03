/**
 * Shared type definitions for Resonance.
 * Centralizes types used across the P2P, simulation, and audio layers.
 */

// ---------------------------------------------------------------------------
// Latent space state (position + taste in the simulation field)
// ---------------------------------------------------------------------------

export interface LatentState {
    x: number;
    y: number;
    spin: number;
}

// ---------------------------------------------------------------------------
// Curatorial Graphs (Proof-of-Curation)
// ---------------------------------------------------------------------------

export interface PoCMetrics {
    discoveryImpact: number; // Unique listeners tuned into this graph
    retentionScore: number;  // Average session length in seconds
}

export interface CuratorialGraph {
    id: string;
    curatorWallet: string;
    name: string;
    tags: string[];
    rules: string[];
    poc: PoCMetrics;
}

// ---------------------------------------------------------------------------
// Peer map (serialized topology from the coordination server)
// ---------------------------------------------------------------------------

export interface PeerMapEntry {
    id: string;
    role: "root" | "relay" | "observer";
    latentState: LatentState;
    connections: number;
    energy: number;
    activeCuratorialGraph?: CuratorialGraph; // Only populated for "root" nodes
}

// ---------------------------------------------------------------------------
// Status unions
// ---------------------------------------------------------------------------

export type ListenerStatus = "AMBIENT" | "CONNECTING" | "LISTENING" | "ERROR";

export type BroadcasterStatus = "IDLE" | "CONNECTING" | "LIVE" | "ERROR";

// ---------------------------------------------------------------------------
// WebRTC configuration
// ---------------------------------------------------------------------------

export const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // NOTE: For production NAT traversal, add a paid TURN provider here
    // (e.g. Metered, Twilio, or Xirsys). Public free TURN servers are unreliable.
];

// ---------------------------------------------------------------------------
// WebRTC signaling contract (discriminated union)
// ---------------------------------------------------------------------------

/** All possible payloads exchanged over the signaling channel. */
export type SignalPayload =
    | { type: "offer"; sdp: string }
    | { type: "answer"; sdp: string }
    | { type: "candidate"; candidate: RTCIceCandidateInit }
    | { type: "batch"; signals: SignalPayload[] };

/** Outbound envelope: client → server (includes the intended target). */
export interface SignalEnvelope {
    target: string;
    signal: SignalPayload;
}

/** Inbound envelope: server → client (includes the original sender). */
export interface InboundSignal {
    sender: string;
    signal: SignalPayload;
}
