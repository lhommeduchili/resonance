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
// Peer map (serialized topology from the coordination server)
// ---------------------------------------------------------------------------

export interface PeerMapEntry {
    id: string;
    role: "root" | "relay" | "observer";
    latentState: LatentState;
    connections: number;
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
];
