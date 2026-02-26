const { createServer } = require("http");
const { parse } = require("url");
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
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
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

    // Minimal state for the Mesh Coordination
    let rootBroadcasterId = null;
    const peers = new Map(); // id -> socket

    io.on("connection", (socket) => {
        console.log(`Node Connected: ${socket.id}`);
        peers.set(socket.id, socket);

        // Broadcaster registers itself
        socket.on("register_broadcaster", (data, callback) => {
            // In a real app, verify Stream Key here
            rootBroadcasterId = socket.id;
            console.log("Root Broadcaster Registered:", socket.id);
            socket.broadcast.emit("broadcast_started", { broadcasterId: socket.id });
            if (callback) callback({ success: true, isRoot: true });
        });

        // Listeners request peers to connect to
        socket.on("request_peers", (data, callback) => {
            // Simplistic topology: Everyone connects directly to the root for testing Protocol
            // Eventually, this will return a list of active relay nodes.
            if (rootBroadcasterId) {
                callback({ peers: [{ id: rootBroadcasterId, role: "root" }] });
            } else {
                callback({ peers: [] }); // No broadcast active
            }
        });

        // WebRTC Signaling Relay
        socket.on("signal", (data) => {
            const { target, signal } = data;
            const targetSocket = peers.get(target);
            if (targetSocket) {
                targetSocket.emit("signal", {
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
