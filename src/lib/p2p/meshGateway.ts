import { logger } from "../logger";
import { startBroadcast, endBroadcast, recordListenerJoin, recordListenerLeave, getGraphMetrics } from "../poc/pipeline";
import { archiveTransport } from "../archive/nodeAudioTransport";
import { calculateEnergyDecay, findOptimalPeer, checkReRouteCondition } from "./coordinationService";
import type { PeerData } from "./coordinationService";
import { Server } from "socket.io";
import type { SignalEnvelope, InboundSignal } from "../types";

interface ArchiveSession {
    onLocalSignal?: (signal: unknown) => void;
    initiateOffer: () => void;
    handleRemoteSignal: (signal: unknown) => void;
}

interface GraphToken {
    id: string;
    curatorWallet: string;
    name: string;
    tags: string[];
    rules: string[];
}

// Mesh Coordination State
let rootBroadcasterId: string | null = null;
let currentBroadcastDbId: string | null = null;
let activeArchiveSession: ArchiveSession | null = null;
const peers = new Map<string, PeerData>();

// Curatorial Graphs Database (Mocking persistent protocol knowledge)
const curatorialGraphs = new Map([
    ["graph-latin-electronica", {
        id: "graph-latin-electronica",
        curatorWallet: "0xCurator1",
        name: "Latin American Dark Electronica",
        tags: ["analog synth", "post-2015", "melancholic"],
        rules: ["no vocal hooks", "BPM < 110"]
    }],
    ["graph-ambient-sleep", {
        id: "graph-ambient-sleep",
        curatorWallet: "0xCurator2",
        name: "Binaural Sleep Geometry",
        tags: ["ambient", "generative", "432hz"],
        rules: ["no percussives", "spatial panning > 50%"]
    }]
]);

async function broadcastPeerMap(io: Server) {
    if (!io) return;
    const serializedPeers: Record<string, unknown>[] = [];

    let rootMetrics = { discoveryImpact: 0, retentionScore: 0 };
    let activeGraph: Record<string, unknown> | null = null;

    if (rootBroadcasterId) {
        const rootData = peers.get(rootBroadcasterId);
        if (rootData && rootData.activeCuratorialGraphId) {
            activeGraph = curatorialGraphs.get(rootData.activeCuratorialGraphId) as unknown as Record<string, unknown> | null;
            try {
                rootMetrics = await getGraphMetrics(rootData.activeCuratorialGraphId);
            } catch (e) {
                console.error("[PoC] Failed to get metrics:", e);
            }
        }
    }

    for (const [id, data] of peers.entries()) {
        const payload: Record<string, unknown> = {
            id,
            role: data.role,
            latentState: data.latentState,
            connections: data.connections,
            energy: data.energy
        };

        if (data.role === "root" && activeGraph) {
            payload.activeCuratorialGraph = {
                id: activeGraph.id,
                curatorWallet: activeGraph.curatorWallet,
                name: activeGraph.name,
                tags: activeGraph.tags,
                rules: activeGraph.rules,
                poc: {
                    discoveryImpact: Number(rootMetrics.discoveryImpact),
                    retentionScore: Number(rootMetrics.retentionScore)
                }
            };
        }
        serializedPeers.push(payload);
    }
    io.emit("peer_map_update", serializedPeers);
}

export function initializeMeshGateway(io: Server) {
    // Flow Energy Thermodynamics Loop
    setInterval(() => {
        calculateEnergyDecay(peers, Date.now());
        broadcastPeerMap(io);
    }, 1000);

    io.on("connection", (socket) => {
        logger.info("Server", `Node Connected: ${socket.id}`);
        peers.set(socket.id, {
            socket: socket,
            role: "observer",
            connections: 0,
            maxCapacity: 0,
            energy: 10,
            lastEnergyUpdate: Date.now(),
            latentState: { x: 0, y: 0, spin: 0 },
            activeCuratorialGraphId: null,
            currentSessionDbId: null
        });

        // Broadcaster registers
        socket.on("register_broadcaster", async (data: unknown, callback: (res: { success: boolean; isRoot: boolean }) => void) => {
            const peerData = peers.get(socket.id);
            if (peerData) {
                peerData.role = "root";
                peerData.maxCapacity = 10;
                peerData.energy = 100;
                peerData.lastEnergyUpdate = Date.now();

                const graphKeys = Array.from(curatorialGraphs.keys());
                peerData.activeCuratorialGraphId = graphKeys[Math.floor(Math.random() * graphKeys.length)];

                try {
                    currentBroadcastDbId = await startBroadcast(peerData.activeCuratorialGraphId, socket.id);
                } catch (e) {
                    console.error("[DB] Failed to start broadcast record", e);
                }
            }
            rootBroadcasterId = socket.id;
            logger.info("Server", "Root Broadcaster Registered:", socket.id);
            socket.broadcast.emit("broadcast_started", { broadcasterId: socket.id });
            await broadcastPeerMap(io);

            try {
                activeArchiveSession = await archiveTransport.subscribe(socket.id) as ArchiveSession;
                activeArchiveSession.onLocalSignal = (signal: unknown) => {
                    socket.emit('signal', {
                        sender: 'ARCHIVE_NODE',
                        signal: signal
                    });
                };
                activeArchiveSession.initiateOffer();
            } catch (e) {
                console.error("[Archive] Failed to attach recorder:", e);
            }

            if (callback) callback({ success: true, isRoot: true });
        });

        socket.on("report_state", (rawData: unknown) => {
            const data = rawData as { latentState?: { x: number; y: number; spin: number }; activeConnections?: number; currentUpstreamId?: string };
            const peerData = peers.get(socket.id);
            if (peerData && data.latentState) {
                peerData.latentState = data.latentState;
                if (data.activeConnections !== undefined) {
                    peerData.connections = data.activeConnections;
                }

                if (data.currentUpstreamId) {
                    peerData.currentUpstreamId = data.currentUpstreamId;
                }

                if (peerData.role !== "root" && peerData.role !== "observer") {
                    const now = Date.now();
                    if (now - ((peerData as unknown as { lastReRouteSuggestionTime?: number }).lastReRouteSuggestionTime || 0) > 10000) {
                        const bestCandidate = findOptimalPeer(socket.id, data.latentState, peers, rootBroadcasterId);

                        if (checkReRouteCondition(bestCandidate, peerData.currentUpstreamId, data.latentState, peers)) {
                            logger.info("Server", `[Re-Route Suggestion] Pushing target ${bestCandidate?.id} to ${socket.id}`);
                            (peerData as unknown as { lastReRouteSuggestionTime: number }).lastReRouteSuggestionTime = now;
                            socket.emit("reconnect_suggestion", {
                                targetPeer: bestCandidate
                            });
                        }
                    }
                }
            }
        });

        socket.on("request_peers", async (rawData: unknown, callback: (res: { peers: unknown[] }) => void) => {
            const data = rawData as { latentState?: { x: number; y: number; spin: number } };
            const peerData = peers.get(socket.id);
            if (peerData && peerData.role === "observer") {
                peerData.role = "relay";
                peerData.maxCapacity = 5;
            }

            const requesterState = data.latentState || { x: 0, y: 0, spin: 0 };
            const bestCandidate = findOptimalPeer(socket.id, requesterState, peers, rootBroadcasterId);

            if (bestCandidate) {
                if (currentBroadcastDbId && peerData && !peerData.currentSessionDbId) {
                    try {
                        const sid = await recordListenerJoin(currentBroadcastDbId, socket.id);
                        peerData.currentSessionDbId = sid;
                    } catch (e) {
                        console.error("[DB] Failed to record listener join", e);
                    }
                }

                logger.info("Server", `Initial Route ${socket.id} -> optimal peer ${bestCandidate.id} (Score: ${Math.floor(bestCandidate.score)})`);
                callback({ peers: [bestCandidate] });
            } else {
                logger.info("Server", `Network saturated. Could not route ${socket.id}`);
                callback({ peers: [] });
            }
        });

        socket.on("signal", (rawData: unknown) => {
            const data = rawData as SignalEnvelope;
            const { target, signal } = data;

            if (target === 'ARCHIVE_NODE' && activeArchiveSession) {
                activeArchiveSession.handleRemoteSignal(signal);
                return;
            }

            const targetPeer = peers.get(target);
            if (targetPeer && targetPeer.socket) {
                const inbound: InboundSignal = {
                    sender: socket.id as string,
                    signal: signal
                };
                targetPeer.socket.emit("signal", inbound);
            }
        });

        const finalizeSession = async (socketId: string) => {
            const peerData = peers.get(socketId);
            if (peerData?.currentSessionDbId) {
                try {
                    await recordListenerLeave(peerData.currentSessionDbId);
                    peerData.currentSessionDbId = null;
                } catch (e) {
                    console.error("[DB] Failed to record listener leave", e);
                }
            }
        };

        socket.on("leave_broadcast", async () => {
            await finalizeSession(socket.id);
        });

        socket.on("disconnect", async () => {
            logger.info("Server", `Node Disconnected: ${socket.id}`);
            await finalizeSession(socket.id);
            peers.delete(socket.id);
            if (socket.id === rootBroadcasterId) {
                if (currentBroadcastDbId) {
                    try {
                        await endBroadcast(currentBroadcastDbId);
                    } catch (e) { console.error("[DB] End err", e); }
                }
                archiveTransport.disconnect(socket.id);
                activeArchiveSession = null;
                rootBroadcasterId = null;
                currentBroadcastDbId = null;
                socket.broadcast.emit("broadcast_ended");
            }
            await broadcastPeerMap(io);
        });
    });
}
