"use client";
import { logger } from "@/lib/logger";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { BroadcasterStatus, PeerMapEntry, InboundSignal } from "@/lib/types";
import { ICE_SERVERS } from "@/lib/types";
import { eventBus } from "@/lib/eventBus";
import { emitCandidate, emitDescription, applyRemoteSignal } from "@/lib/p2p/signalTransport";
import { type AudioProfileMode, AUDIO_PROFILES, DEFAULT_AUDIO_PROFILE } from "@/lib/audio/profiles";
import { createLimitedStream, type LimiterSession } from "@/lib/audio/broadcastLimiter";

interface UseBroadcasterOptions {
  streamKey: string;
}

export function useBroadcaster({ streamKey }: UseBroadcasterOptions) {
  const [status, setStatus] = useState<BroadcasterStatus>("IDLE");
  const [listeners, setListeners] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeProfile, setActiveProfile] = useState<AudioProfileMode>(DEFAULT_AUDIO_PROFILE.id);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentDeviceIdRef = useRef<string | undefined>(undefined);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const reportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limiterRef = useRef<LimiterSession | null>(null);

  const stopBroadcast = () => {
    if (limiterRef.current) {
      limiterRef.current.destroy();
      limiterRef.current = null;
    }
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
      if (socketRef.current.id) {
        eventBus.emit("broadcast_ended", { broadcasterId: socketRef.current.id });
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus("IDLE");
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        emitCandidate(socket, targetId, event.candidate);
      }
    };

    // Add audio tracks to the peer connection
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    peerConnectionsRef.current.set(targetId, pc);
    setListeners((prev) => prev + 1);

    pc.onconnectionstatechange = () => {
      logger.info("P2P-Broadcaster", `[PC] Connection state for ${targetId}:`, pc.connectionState);
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
    currentDeviceIdRef.current = deviceId;
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...AUDIO_PROFILES[activeProfile].constraints,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        video: false,
      };
      const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = rawStream;
      setActiveStream(rawStream);

      // Route through the transparent limiter before WebRTC
      const limiter = createLimitedStream(rawStream, activeProfile);
      limiterRef.current = limiter;
      const stream = limiter.outputStream;

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

              if (socket.id) {
                eventBus.emit("broadcast_started", { broadcasterId: socket.id });
              }

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

      socket.on(
        "signal",
        async (data: InboundSignal) => {
          const { sender, signal } = data;
          let pc = peerConnectionsRef.current.get(sender);

          if (signal.type === "offer" || signal.type === "answer") {
            if (!pc) pc = createPeerConnection(sender, stream, socket);
            await applyRemoteSignal(pc, signal);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            emitDescription(socket, sender, answer);
          } else if (signal.type === "candidate" && pc) {
            await applyRemoteSignal(pc, signal);
          }
        },
      );
    } catch (e) {
      console.error(e);
      setStatus("ERROR");
    }
  };

  const changeDevice = async (deviceId: string) => {
    if (!streamRef.current || status !== "LIVE") return;
    currentDeviceIdRef.current = deviceId;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...AUDIO_PROFILES[activeProfile].constraints,
          deviceId: { exact: deviceId },
        },
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

  const changeAudioProfile = async (profileId: AudioProfileMode) => {
    if (activeProfile === profileId) return;
    setActiveProfile(profileId);

    // If not live yet, we just update the state so startBroadcast uses the right one.
    if (status !== "LIVE" || !streamRef.current) return;

    try {
      const newConstraints: MediaStreamConstraints = {
        audio: {
          ...AUDIO_PROFILES[profileId].constraints,
          ...(currentDeviceIdRef.current ? { deviceId: { exact: currentDeviceIdRef.current } } : {}),
        },
        video: false,
      };

      const newRawStream = await navigator.mediaDevices.getUserMedia(newConstraints);

      // Rebuild the limiter with the new profile's preset
      if (limiterRef.current) {
        limiterRef.current.destroy();
      }
      const limiter = createLimitedStream(newRawStream, profileId);
      limiterRef.current = limiter;

      const newAudioTrack = limiter.outputStream.getAudioTracks()[0];

      // Hot-swap the limited track on all active peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) {
          sender.replaceTrack(newAudioTrack);
        }
      });

      // Stop old raw tracks
      streamRef.current.getTracks().forEach((t) => t.stop());

      // Update refs and state (raw stream for waveform, limited goes to WebRTC)
      streamRef.current = newRawStream;
      setActiveStream(newRawStream);

      // Allow components (like Canvas) to react to this profile change visually
      eventBus.emit("audio_profile_changed", { profile: profileId });

    } catch (e) {
      console.error(`Failed to swap audio profile to ${profileId}`, e);
      // Revert state if failed
      setActiveProfile(activeProfile);
    }
  };



  return {
    status,
    listeners,
    socketId,
    globalPeerMap,
    devices,
    activeProfile,
    activeStream,
    previewStream,
    startBroadcast,
    stopBroadcast,
    changeDevice,
    changeAudioProfile,
  };
}
