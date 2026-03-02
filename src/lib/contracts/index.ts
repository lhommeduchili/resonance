// src/lib/contracts/index.ts

/**
 * RESONANCE — ARCHITECTURE CONTRACTS
 * 
 * This file enforces the architectural boundaries defined in docs/ARCHITECTURE.md.
 * These interfaces MUST NOT bleed specific implementation logic or libraries 
 * (like Socket.io, Postgres, WebRTC specifics) into the dependent systems.
 */

// --- 1. GLOBAL EVENT BUS CONTRACT ---
export interface ResonanceEvent<T = unknown> {
    type: string;
    timestamp: number;
    payload: T;
}

// --- 2. TRANSPORT CONTRACT (WebRTC Isolation) ---
export interface TransportStats {
    latency: number;
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
}

export interface AudioTransport {
    // We use MediaStream for browser-side, but Node might use raw track buffers.
    // The implementations will handle this typing behind the abstraction.
    publish(stream: unknown): Promise<void>;
    subscribe(peerId: string): Promise<unknown>;
    disconnect(peerId: string): void;
    getStats(): TransportStats;
}

// --- 3. SIMULATION ENGINE CONTRACT ---
export interface SimulationState {
    nodes: unknown[];
    particles: unknown[];
    energyLevel: number;
}

export interface InteractionEvent {
    type: string;
    nodeId: string;
}

export interface SimulationEngine {
    step(deltaTime: number): SimulationState;
    injectInteraction(event: InteractionEvent): void;
}

// --- 4. CURATORIAL GRAPH CONTRACT ---
export interface Channel {
    id: string;
    name: string;
    tags: string[];
}

export interface CuratorialGraph {
    curatorId: string;
    channels: Channel[];
    attributionScore(sessionId: string): number;
}

// --- 5. ENERGY ENGINE CONTRACT ---
export interface EnergyState {
    totalCirculating: number;
    distribution: Record<string, number>;
}

export interface EnergyEngine {
    registerSupport(listenerId: string, channelId: string, rate: number): void;
    decay(timeDelta: number): void;
    snapshot(): EnergyState;
}

// --- 6. STORAGE CONTRACT (Persistence) ---
export interface SessionData {
    sessionId: string;
    broadcastId: string;
    joinedAt: number;
    leftAt: number;
}

export interface PersistenceAdapter {
    saveEvent(event: ResonanceEvent): Promise<void>;
    loadSession(sessionId: string): Promise<SessionData>;
    // Returns the IPFS hash or local filename path
    storeArchive(chunk: ArrayBuffer, broadcastId: string, sequenceNum: number): Promise<string>;
}

// --- 7. IDENTITY CONTRACT ---
export interface Signature {
    r: Uint8Array;
    s: Uint8Array;
    v: number;
}

export interface IdentityProvider {
    getUserId(): string;
    sign(data: Uint8Array): Promise<Signature>;
    verify(signature: Signature): boolean;
}

// --- 8. BLOCKCHAIN ADAPTER CONTRACT (Plugin) ---
export interface SettlementAdapter {
    anchorSnapshot(snapshot: EnergyState): Promise<string>;
    verifyAnchor(hash: string): Promise<boolean>;
}
