"use client";
import { logger } from "@/lib/logger";

import { useEffect, useRef, useState } from "react";
import type { BroadcasterStatus, PeerMapEntry } from "@/lib/types";
import { ICE_SERVERS, type SignalPayload } from "@/lib/types";
import { eventBus } from "@/lib/eventBus";
import { emitCandidate, emitDescription, applyRemoteSignal } from "@/lib/p2p/signalTransport";
import { NostrSignaler } from "@/lib/p2p/nostrSignal";
import { type AudioProfileMode, AUDIO_PROFILES, DEFAULT_AUDIO_PROFILE } from "@/lib/audio/profiles";
import { createLimitedStream, type LimiterSession } from "@/lib/audio/broadcastLimiter";


export function useBroadcaster() {
  const [status, setStatus] = useState<BroadcasterStatus>("IDLE");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [listeners, setListeners] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [npub, setNpub] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeProfile, setActiveProfile] = useState<AudioProfileMode>(DEFAULT_AUDIO_PROFILE.id);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const signalerRef = useRef<NostrSignaler | null>(null);
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

    if (signalerRef.current) {
      if (signalerRef.current.publicKey) {
        eventBus.emit("broadcast_ended", { broadcasterId: signalerRef.current.publicKey });
      }
      signalerRef.current.close();
      signalerRef.current = null;
    }
    setStatus("IDLE");
    setErrorDetail(null);
    setNpub(null);
    setGlobalPeerMap([]);
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
    signaler: NostrSignaler,
  ): RTCPeerConnection => {
    // Note: STUN/TURN servers are required for production WebRTC
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(signaler, targetId, event.candidate);
      }
    };

    // Add audio tracks to the peer connection
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    peerConnectionsRef.current.set(targetId, pc);

    pc.onconnectionstatechange = () => {
      logger.info("P2P-Broadcaster", `[PC] Connection state for ${targetId}:`, pc.connectionState);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        pc.close();
        peerConnectionsRef.current.delete(targetId);
        setListeners(peerConnectionsRef.current.size);
      } else if (pc.connectionState === "connected") {
        setListeners(peerConnectionsRef.current.size);
      }
    };

    return pc;
  };

  const startBroadcast = async (deviceId?: string) => {
    setStatus("CONNECTING");
    setErrorDetail(null);
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

      const signaler = new NostrSignaler();
      signalerRef.current = signaler;
      setNpub(signaler.publicKey);

      // Subscribe to WebRTC signals
      signaler.subscribeToSignals(async (senderPubKey: string, signal: SignalPayload) => {
        let pc = peerConnectionsRef.current.get(senderPubKey);

        if (signal.type === "offer") {
          // New offer from this peer — close any stale connection first
          // (the peer may have refreshed, creating fresh ICE credentials).
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(senderPubKey);
          }
          pc = createPeerConnection(senderPubKey, stream, signaler);
          await applyRemoteSignal(pc, signal);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitDescription(signaler, senderPubKey, answer);
        } else if (signal.type === "answer" && pc) {
          await applyRemoteSignal(pc, signal);
        } else if (signal.type === "candidate" && pc) {
          await applyRemoteSignal(pc, signal);
        }
      });

      // Subscribe to the global topology
      signaler.subscribeToTopology((peers: PeerMapEntry[]) => {
        // We include ourselves in the render output for the Broadcaster
        setGlobalPeerMap([
          {
            id: signaler.publicKey,
            role: "root",
            latentState: { x: window.innerWidth / 2, y: window.innerHeight / 2, spin: 0.5 },
            connections: peerConnectionsRef.current.size,
            energy: 100,
          },
          ...peers
        ]);
      });

      setStatus("LIVE");
      eventBus.emit("broadcast_started", { broadcasterId: signaler.publicKey });

      // Cache our presence as a Root node and start the 30s beacon
      signaler.updatePresenceData(
        "root",
        { x: window.innerWidth / 2, y: window.innerHeight / 2, spin: 0.5 },
        peerConnectionsRef.current.size,
        100
      );
      signaler.startPresenceBeacon();

      // The interval syncs our local map state periodically if no topology updates arrive
      reportIntervalRef.current = setInterval(() => {
        setGlobalPeerMap(prev => {
          const others = prev.filter(p => p.id !== signaler.publicKey);
          return [
            {
              id: signaler.publicKey,
              role: "root",
              latentState: { x: window.innerWidth / 2, y: window.innerHeight / 2, spin: 0.5 },
              connections: peerConnectionsRef.current.size,
              energy: 100,
            },
            ...others
          ];
        });

        // Keep the cached presence data fresh for the beacon
        signaler.updatePresenceData(
          "root",
          { x: window.innerWidth / 2, y: window.innerHeight / 2, spin: 0.5 },
          peerConnectionsRef.current.size,
          100
        );
      }, 5000);

    } catch (e: unknown) {
      console.error(e);
      setStatus("ERROR");
      if (e instanceof Error) {
        setErrorDetail(e.message || e.name);
      } else {
        setErrorDetail(String(e));
      }
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

      // Update refs and state
      streamRef.current = newRawStream;
      setActiveStream(newRawStream);

      eventBus.emit("audio_profile_changed", { profile: profileId });

    } catch (e) {
      console.error(`Failed to swap audio profile to ${profileId}`, e);
      setActiveProfile(activeProfile);
    }
  };

  return {
    status,
    errorDetail,
    listeners,
    socketId: npub, // Expose npub disguised as socketId for UI backward compatibility temporarily
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
