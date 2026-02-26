"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useListener() {
    const [status, setStatus] = useState<"IDLE" | "CONNECTING" | "LISTENING" | "ERROR">("IDLE");
    const [activePeers, setActivePeers] = useState<number>(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const audioElementRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Create a hidden audio element to play the received stream
        const audio = new Audio();
        audio.autoplay = true;
        audioElementRef.current = audio;

        return () => stopListening();
    }, []);

    const createPeerConnection = (targetId: string, socket: Socket) => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("signal", { target: targetId, signal: { type: "candidate", candidate: event.candidate } });
            }
        };

        pc.ontrack = (event) => {
            console.log("[PC] Track received from:", targetId);
            if (audioElementRef.current && event.streams[0]) {
                if (!audioElementRef.current.srcObject) {
                    audioElementRef.current.srcObject = event.streams[0];
                    setStatus("LISTENING");

                    // --- Spatial Audio Implementation ---
                    if (audioContextRef.current) {
                        const ctx = audioContextRef.current;
                        const source = ctx.createMediaStreamSource(event.streams[0]);

                        // Create Panner and Gain nodes
                        const panner = ctx.createStereoPanner();
                        const gainNode = ctx.createGain();

                        source.connect(panner);
                        panner.connect(gainNode);
                        gainNode.connect(ctx.destination);

                        // Mute the raw audio element to only hear the spatialized web audio output
                        audioElementRef.current.muted = true;

                        // Map mouse position to spatial audio (temporary listener-centric physics)
                        // Center of screen is node. Close = loud, Left = pan left, etc.
                        const handleMouseMove = (e: MouseEvent) => {
                            const x = e.clientX;
                            const y = e.clientY;
                            const w = window.innerWidth;
                            const h = window.innerHeight;

                            // Pan: -1 (left) to 1 (right)
                            panner.pan.value = (x / w) * 2 - 1;

                            // Volume drops off as you move away from center (simulating the Halo)
                            const cx = w / 2;
                            const cy = h / 2;
                            const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
                            const maxDist = Math.max(w, h) / 2;

                            // Gain approaches 0.1 at edges, 1.0 at center
                            const volume = Math.max(0.1, 1 - (dist / maxDist));
                            gainNode.gain.value = volume;
                        };

                        window.addEventListener("mousemove", handleMouseMove);

                        // Cleanup listener on disconnect
                        pc.addEventListener("iceconnectionstatechange", () => {
                            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                                window.removeEventListener("mousemove", handleMouseMove);
                            }
                        });
                    }
                }
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                pc.close();
                peerConnectionsRef.current.delete(targetId);
                setActivePeers(peerConnectionsRef.current.size);
            }
        };

        peerConnectionsRef.current.set(targetId, pc);
        setActivePeers(peerConnectionsRef.current.size);
        return pc;
    };

    const startListening = async () => {
        if (status !== "IDLE") return;
        setStatus("CONNECTING");

        // Initialize AudioContext to bypass auto-play policies (requires user gesture)
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        await audioContextRef.current.resume();

        const socket = io();
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected to Coordination Server. Requesting peers...");
            // Ask Coordination Server for available peers to connect to
            socket.emit("request_peers", {}, async (res: { peers: { id: string, role: string }[] }) => {
                if (res.peers && res.peers.length > 0) {
                    const targetPeer = res.peers[0]; // Connect to first available for now
                    const pc = createPeerConnection(targetPeer.id, socket);

                    // We are the listener, so we initiate the offer
                    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
                    await pc.setLocalDescription(offer);
                    socket.emit("signal", { target: targetPeer.id, signal: offer });
                } else {
                    console.log("No active broadcasts found.");
                    setStatus("IDLE"); // Or "AWAITING SIGNAL" state
                }
            });
        });

        socket.on("signal", async (data: { sender: string, signal: any }) => {
            const { sender, signal } = data;
            let pc = peerConnectionsRef.current.get(sender);

            if (signal.type === "answer" && pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
            } else if (signal.type === "candidate" && pc) {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        });

        socket.on("broadcast_started", () => {
            // Auto-reconnect or try fetching peers if a broadcast starts
            if (status === "IDLE") {
                startListening();
            }
        });

        socket.on("disconnect", () => {
            setStatus("IDLE");
            if (audioElementRef.current) audioElementRef.current.srcObject = null;
        });
    };

    const stopListening = () => {
        if (audioElementRef.current) {
            audioElementRef.current.srcObject = null;
        }
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
        setActivePeers(0);

        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setStatus("IDLE");
    };

    return { status, activePeers, startListening, stopListening };
}
