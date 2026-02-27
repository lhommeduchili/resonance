const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

// Initialize the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            // Use the WHATWG URL API, but pass the structure Next.js expects (pathname and parsed query)
            const parsedUrl = new URL(req.url || "/", `http://${req.headers.host}`);
            await handle(req, res, {
                pathname: parsedUrl.pathname,
                query: Object.fromEntries(parsedUrl.searchParams)
            });
        } catch (err) {
            console.error("Error occurred handling", req.url, err);
            res.statusCode = 500;
            res.end("internal server error");
        }
    });

    // Initialize Socket.io Coordination Server
    const io = new Server(server, {
        cors: {
            origin: "*", // Adjust for production
            methods: ["GET", "POST"]
        }
    });

    // Mesh Coordination State
    let rootBroadcasterId = null;

    // peers Map schema:
    // id -> { socket, role: 'root' | 'relay', connections: number, maxCapacity: number, latentState: { x, y, spin } }
    const peers = new Map();

    const broadcastPeerMap = () => {
        if (!io) return;
        const serializedPeers = [];
        for (const [id, data] of peers.entries()) {
            serializedPeers.push({
                id,
                role: data.role,
                latentState: data.latentState,
                connections: data.connections
            });
        }
        io.emit("peer_map_update", serializedPeers);
    };

    io.on("connection", (socket) => {
        console.log(`Node Connected: ${socket.id}`);
        peers.set(socket.id, {
            socket: socket,
            role: "observer", // Start as observer, upgrade to relay upon streaming
            connections: 0,
            maxCapacity: 0,
            latentState: { x: 0, y: 0, spin: 0 } // Default physics state
        });

        // Broadcaster registers itself
        socket.on("register_broadcaster", (data, callback) => {
            const peerData = peers.get(socket.id);
            if (peerData) {
                peerData.role = "root";
                peerData.maxCapacity = 10; // Root can usually handle more, but we still prefer mesh
            }
            rootBroadcasterId = socket.id;
            console.log("Root Broadcaster Registered:", socket.id);
            socket.broadcast.emit("broadcast_started", { broadcasterId: socket.id });
            broadcastPeerMap();
            if (callback) callback({ success: true, isRoot: true });
        });

        const findOptimalPeer = (requesterId, requesterState) => {
            if (!rootBroadcasterId || !peers.has(rootBroadcasterId)) return null;

            let bestCandidate = null;
            let highestScore = -Infinity;

            for (const [id, peerData] of peers.entries()) {
                // Cannot connect to self, observers, and candidate must have capacity
                if (id === requesterId) continue;
                if (peerData.role === "observer") continue;
                if (peerData.connections >= peerData.maxCapacity) continue;

                // 1. Stability Score (Root is safest, relays are riskier)
                const rootLoad = peerData.connections / peerData.maxCapacity;
                const stabilityScore = peerData.role === "root" ? (1 - rootLoad) * 30 : 0;

                // 2. Bandwidth Score (Prefer nodes with fewer current connections)
                const capacityRatio = peerData.connections / peerData.maxCapacity;
                const bandwidthScore = (1 - capacityRatio) * 30;

                // 3. Latent Adjacency Score (Physics distance in Field)
                const dx = peerData.latentState.x - requesterState.x;
                const dy = peerData.latentState.y - requesterState.y;
                const dSpin = Math.abs(peerData.latentState.spin - requesterState.spin);

                // Max canvas distance ~ 500px for strong attraction
                const spatialDist = Math.sqrt(dx * dx + dy * dy);

                let adjacencyScore = 0;
                if (spatialDist < 500) {
                    const normalizedSpatialDist = 1 - (spatialDist / 500);
                    const normalizedSpinDist = Math.max(0, 1 - (dSpin > 0.5 ? 1 - dSpin : dSpin) * 4); // spin difference impact
                    adjacencyScore = (normalizedSpatialDist * 80) + (normalizedSpinDist * 20);
                }

                const totalScore = stabilityScore + bandwidthScore + adjacencyScore;

                if (totalScore > highestScore) {
                    highestScore = totalScore;
                    bestCandidate = { id, role: peerData.role, score: totalScore };
                }
            }
            return bestCandidate;
        };

        // Nodes continually report their physics state
        socket.on("report_state", (data) => {
            const peerData = peers.get(socket.id);
            if (peerData && data.latentState) {
                peerData.latentState = data.latentState;
                if (data.activeConnections !== undefined) {
                    peerData.connections = data.activeConnections;
                }

                // Track current upstream to avoid suggesting the same one
                if (data.currentUpstreamId) {
                    peerData.currentUpstreamId = data.currentUpstreamId;
                }

                if (peerData.role !== "root") {
                    const bestCandidate = findOptimalPeer(socket.id, data.latentState);
                    // Hysteresis: only suggest a swap if the new candidate is significantly better
                    // (e.g. they moved drastically closer to a peer than the root)
                    // AND it's not their current upstream parent
                    if (bestCandidate && bestCandidate.id !== peerData.currentUpstreamId) {

                        let currentParentScore = 0;
                        const currentParentData = peers.get(peerData.currentUpstreamId);
                        if (currentParentData) {
                            const rootLoad = currentParentData.connections / currentParentData.maxCapacity;
                            const sScore = currentParentData.role === "root" ? (1 - rootLoad) * 30 : 0;
                            const cRatio = currentParentData.connections / currentParentData.maxCapacity;
                            const bScore = (1 - cRatio) * 30;
                            const dx = currentParentData.latentState.x - data.latentState.x;
                            const dy = currentParentData.latentState.y - data.latentState.y;
                            const dSpin = Math.abs(currentParentData.latentState.spin - data.latentState.spin);
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            let aScore = 0;
                            if (dist < 500) {
                                const nDist = 1 - (dist / 500);
                                const nSpin = Math.max(0, 1 - (dSpin > 0.5 ? 1 - dSpin : dSpin) * 4);
                                aScore = (nDist * 80) + (nSpin * 20);
                            }
                            currentParentScore = sScore + bScore + aScore;
                        }

                        if (bestCandidate.score > currentParentScore + 20) {
                            console.log(`[Re-Route Suggestion] Pushing target ${bestCandidate.id} to ${socket.id}`);
                            socket.emit("reconnect_suggestion", {
                                targetPeer: bestCandidate
                            });
                        }
                    }
                }
            }
            // Always broadcast the map when ANY node reports a new latent position
            broadcastPeerMap();
        });

        // Adaptive Routing: Listeners request the optimal peers to connect to initially
        socket.on("request_peers", (data, callback) => {
            const peerData = peers.get(socket.id);
            if (peerData && peerData.role === "observer") {
                peerData.role = "relay";
                peerData.maxCapacity = 5;
            }

            const requesterState = data.latentState || { x: 0, y: 0, spin: 0 };
            const bestCandidate = findOptimalPeer(socket.id, requesterState);

            if (bestCandidate) {
                console.log(`Initial Route ${socket.id} -> optimal peer ${bestCandidate.id} (Score: ${Math.floor(bestCandidate.score)})`);
                callback({ peers: [bestCandidate] });
            } else {
                console.log(`Network saturated. Could not route ${socket.id}`);
                callback({ peers: [] }); // Saturated
            }
        });

        // WebRTC Signaling Relay
        socket.on("signal", (data) => {
            const { target, signal } = data;
            const targetPeer = peers.get(target);
            if (targetPeer && targetPeer.socket) {
                targetPeer.socket.emit("signal", {
                    sender: socket.id,
                    signal: signal
                });
            }
        });

        socket.on("disconnect", () => {
            console.log(`Node Disconnected: ${socket.id}`);
            peers.delete(socket.id);
            if (socket.id === rootBroadcasterId) {
                rootBroadcasterId = null;
                socket.broadcast.emit("broadcast_ended");
            }
            broadcastPeerMap();
        });
    });

    server
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
