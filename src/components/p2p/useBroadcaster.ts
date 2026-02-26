"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseBroadcasterOptions {
    streamKey: string;
}

export function useBroadcaster({ streamKey }: UseBroadcasterOptions) {
    const [status, setStatus] = useState<"IDLE" | "CONNECTING" | "LIVE" | "ERROR">("IDLE");
    const [listeners, setListeners] = useState<number>(0);
    const socketRef = useRef<Socket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    useEffect(() => {
        return () => stopBroadcast();
    }, []);

    const createPeerConnection = (targetId: string, stream: MediaStream, socket: Socket): RTCPeerConnection => {
        // Note: STUN/TURN servers are required for production WebRTC
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("signal", { target: targetId, signal: { type: "candidate", candidate: event.candidate } });
            }
        };

        // Add audio tracks to the peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        peerConnectionsRef.current.set(targetId, pc);
        setListeners((prev) => prev + 1);

        pc.onconnectionstatechange = () => {
            console.log(`[PC] Connection state for ${targetId}:`, pc.connectionState);
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                pc.close();
                peerConnectionsRef.current.delete(targetId);
                setListeners((prev) => Math.max(0, prev - 1));
            }
        };

        return pc;
    };

    const startBroadcast = async () => {
        setStatus("CONNECTING");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;

            const socket = io(); // Connects to the same origin (Coordination server)
            socketRef.current = socket;

            socket.on("connect", () => {
                socket.emit("register_broadcaster", { key: streamKey }, (res: { success: boolean, isRoot: boolean }) => {
                    if (res.success) {
                        setStatus("LIVE");
                    } else {
                        setStatus("ERROR");
                    }
                });
            });

            // Handle signal from a Listener wanting to connect directly to Root Node
            socket.on("signal", async (data: { sender: string, signal: any }) => {
                const { sender, signal } = data;
                let pc = peerConnectionsRef.current.get(sender);

                if (signal.type === "offer") {
                    if (!pc) pc = createPeerConnection(sender, stream, socket);
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit("signal", { target: sender, signal: answer });
                } else if (signal.type === "candidate" && pc) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                }
            });

        } catch (e) {
            console.error(e);
            setStatus("ERROR");
        }
    };

    const stopBroadcast = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
        setListeners(0);

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setStatus("IDLE");
    };

    return { status, listeners, startBroadcast, stopBroadcast };
}
