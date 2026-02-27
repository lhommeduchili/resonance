"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { BroadcasterStatus, PeerMapEntry } from "@/lib/types";
import { ICE_SERVERS } from "@/lib/types";

interface UseBroadcasterOptions {
  streamKey: string;
}

export function useBroadcaster({ streamKey }: UseBroadcasterOptions) {
  const [status, setStatus] = useState<BroadcasterStatus>("IDLE");
  const [listeners, setListeners] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const reportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Fetch available audio input devices and keep the preview stream alive
    const fetchDevices = async () => {
      try {
        const preview = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setPreviewStream(preview);
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);
      } catch (err) {
        console.error("Failed to enumerate devices", err);
      }
    };
    fetchDevices();

    return () => stopBroadcast();
  }, []);

  const createPeerConnection = (
    targetId: string,
    stream: MediaStream,
    socket: Socket,
  ): RTCPeerConnection => {
    // Note: STUN/TURN servers are required for production WebRTC
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          target: targetId,
          signal: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    // Add audio tracks to the peer connection
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    peerConnectionsRef.current.set(targetId, pc);
    setListeners((prev) => prev + 1);

    pc.onconnectionstatechange = () => {
      console.log(`[PC] Connection state for ${targetId}:`, pc.connectionState);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        pc.close();
        peerConnectionsRef.current.delete(targetId);
        setListeners((prev) => Math.max(0, prev - 1));
      }
    };

    return pc;
  };

  const startBroadcast = async (deviceId?: string) => {
    setStatus("CONNECTING");
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setActiveStream(stream);

      // Stop the preview stream since the live stream now owns the mic
      if (previewStream) {
        previewStream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
      }

      const socket = io(); // Connects to the same origin (Coordination server)
      socketRef.current = socket;

      socket.on("connect", () => {
        setSocketId(socket.id || null);
        socket.emit(
          "register_broadcaster",
          { key: streamKey },
          (res: { success: boolean; isRoot: boolean }) => {
            if (res.success) {
              setStatus("LIVE");

              // Broadcast initial location instantly so observers can see the Root Node
              socket.emit("report_state", {
                latentState: {
                  x: window.innerWidth / 2,
                  y: window.innerHeight / 2,
                  spin: 0.5,
                },
                activeConnections: peerConnectionsRef.current.size,
              });

              // Root broadcaster sits at the center of the latent space and reports periodically
              reportIntervalRef.current = setInterval(() => {
                if (socket.connected) {
                  socket.emit("report_state", {
                    latentState: {
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                      spin: 0.5,
                    },
                    activeConnections: peerConnectionsRef.current.size,
                  });
                }
              }, 5000);
            } else {
              setStatus("ERROR");
            }
          },
        );
      });

      socket.on("peer_map_update", (peers: PeerMapEntry[]) => {
        setGlobalPeerMap(peers);
        setListeners(Math.max(0, peers.length - 1)); // Exclude root
      });

      // Handle signal from a Listener wanting to connect directly to Root Node
      socket.on("signal", async (data: { sender: string; signal: any }) => {
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

  const changeDevice = async (deviceId: string) => {
    if (!streamRef.current || status !== "LIVE") return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: { deviceId: { exact: deviceId } },
        video: false,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newAudioTrack = newStream.getAudioTracks()[0];

      // Hot-swap the track on all active peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) {
          sender.replaceTrack(newAudioTrack);
        }
      });

      // Stop old tracks
      streamRef.current.getTracks().forEach((t) => t.stop());

      // Update refs and state
      streamRef.current = newStream;
      setActiveStream(newStream);
    } catch (e) {
      console.error("Failed to swap audio device", e);
    }
  };

  const stopBroadcast = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActiveStream(null);
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
    }
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setListeners(0);

    if (reportIntervalRef.current) {
      clearInterval(reportIntervalRef.current);
      reportIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus("IDLE");
  };

  return {
    status,
    listeners,
    socketId,
    globalPeerMap,
    devices,
    activeStream,
    previewStream,
    startBroadcast,
    stopBroadcast,
    changeDevice,
  };
}
