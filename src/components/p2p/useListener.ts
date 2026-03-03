"use client";
import { logger } from "@/lib/logger";

import { useEffect, useRef, useState } from "react";
import type { LatentState, ListenerStatus, PeerMapEntry } from "@/lib/types";
import { ICE_SERVERS, type SignalPayload } from "@/lib/types";
import { useNetworkTelemetry } from "./useNetworkTelemetry";
import { eventBus } from "@/lib/eventBus";
import { emitCandidate, emitDescription, applyRemoteSignal } from "@/lib/p2p/signalTransport";
import { NostrSignaler } from "@/lib/p2p/nostrSignal";

export function useListener() {
  const [status, setStatus] = useState<ListenerStatus>("AMBIENT");
  const [activePeers, setActivePeers] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [npub, setNpub] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [upstreamTargetId, setUpstreamTargetId] = useState<string | null>(null);

  const statusRef = useRef(status);
  const signalerRef = useRef<NostrSignaler | null>(null);
  const lastReportedLatentRef = useRef<LatentState | null>(null);
  const upstreamTargetIdRef = useRef<string | null>(null);

  const upstreamPcRef = useRef<RTCPeerConnection | null>(null);
  const pendingUpstreamPcRef = useRef<RTCPeerConnection | null>(null);
  const downstreamPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const { dataTransferRate } = useNetworkTelemetry(upstreamPcRef, status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  function stopListening() {
    if (upstreamPcRef.current) {
      upstreamPcRef.current.close();
      upstreamPcRef.current = null;
    }
    if (pendingUpstreamPcRef.current) {
      pendingUpstreamPcRef.current.close();
      pendingUpstreamPcRef.current = null;
    }

    upstreamTargetIdRef.current = null;
    setUpstreamTargetId(null);

    downstreamPcsRef.current.forEach((pc) => pc.close());
    downstreamPcsRef.current.clear();

    setStatus("AMBIENT");
    statusRef.current = "AMBIENT";

    if (signalerRef.current?.publicKey) {
      eventBus.emit('listener_left', { nodeId: signalerRef.current.publicKey });
    }
  }

  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    // Keep the element muted — it exists only to hold the MediaStream reference
    // (required by some browsers). All audible output goes through the Web Audio graph.
    audio.muted = true;
    audio.volume = 0;
    audioElementRef.current = audio;

    const signaler = new NostrSignaler();
    signalerRef.current = signaler;
    setNpub(signaler.publicKey);

    // Subscribe to WebRTC signaling
    signaler.subscribeToSignals(async (senderPubKey: string, signal: SignalPayload) => {
      if (signal.type === "answer" && upstreamPcRef.current) {
        if (upstreamPcRef.current.signalingState === "have-local-offer") {
          await applyRemoteSignal(upstreamPcRef.current, signal)
            .catch((e) => console.warn("Failed to set remote answer:", e));
        } else {
          console.warn(`[PC] Ignored answer because signalingState is ${upstreamPcRef.current.signalingState}`);
        }
      } else if (signal.type === "offer") {
        const currentStream = audioStreamRef.current;
        let childPc = downstreamPcsRef.current.get(senderPubKey);
        if (!childPc) {
          childPc = createDownstreamConnection(senderPubKey, currentStream, signaler);
        }

        await applyRemoteSignal(childPc, signal);
        const answer = await childPc.createAnswer();
        await childPc.setLocalDescription(answer);
        emitDescription(signaler, senderPubKey, answer);
      } else if (signal.type === "candidate") {
        if (upstreamPcRef.current && upstreamPcRef.current.remoteDescription) {
          await applyRemoteSignal(upstreamPcRef.current, signal).catch(console.warn);
        }
        const childPc = downstreamPcsRef.current.get(senderPubKey);
        if (childPc && childPc.remoteDescription) {
          await applyRemoteSignal(childPc, signal).catch(console.warn);
        }
      }
    });

    // Subscribe to the global topology map
    signaler.subscribeToTopology((peers: PeerMapEntry[]) => {
      setGlobalPeerMap(peers);
      setActivePeers(Math.max(0, peers.length));
    });

    // Announce initial presence
    const initialLatent = {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      spin: Math.random(),
    };
    lastReportedLatentRef.current = { ...initialLatent };

    signaler.updatePresenceData(
      "observer",
      initialLatent,
      downstreamPcsRef.current.size,
      10 // base observer energy
    );
    signaler.startPresenceBeacon();

    const handleLatentUpdate = (e: CustomEvent) => {
      const newState = e.detail;
      const oldState = lastReportedLatentRef.current;

      if (oldState) {
        const distSq =
          Math.pow(newState.x - oldState.x, 2) +
          Math.pow(newState.y - oldState.y, 2);
        const spinDiff = Math.abs(newState.spin - oldState.spin);

        if (distSq > 2500 || spinDiff > 0.05) {
          // Time debounce: Only announce physical movements every 10 seconds at maximum.
          const now = Date.now();
          const untypedState = lastReportedLatentRef.current as unknown as Record<string, unknown>;
          if (!lastReportedLatentRef.current || (now - (typeof untypedState.timestamp === 'number' ? untypedState.timestamp : 0) > 10000)) {
            signaler.updatePresenceData(
              audioStreamRef.current ? "relay" : "observer",
              newState,
              downstreamPcsRef.current.size,
              10 // base observer energy
            );
            lastReportedLatentRef.current = { ...newState, timestamp: now };
          }
        }
      } else {
        const now = Date.now();
        signaler.updatePresenceData(
          audioStreamRef.current ? "relay" : "observer",
          newState,
          downstreamPcsRef.current.size,
          10 // base observer energy
        );
        lastReportedLatentRef.current = { ...newState, timestamp: now };
      }
    };

    window.addEventListener(
      "resonance_latent_update",
      handleLatentUpdate as EventListener,
    );

    return () => {
      stopListening();
      if (signalerRef.current) {
        signalerRef.current.close();
      }
      if (audio) {
        audio.pause();
        audio.srcObject = null;
      }
      window.removeEventListener(
        "resonance_latent_update",
        handleLatentUpdate as EventListener,
      );
    };
  }, []);

  const createUpstreamConnection = (
    targetId: string,
    signaler: NostrSignaler,
  ): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(signaler, targetId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      logger.info("P2P-Listener", "[PC] Upstream track received from:", targetId);

      if (pendingUpstreamPcRef.current === pc && upstreamPcRef.current) {
        logger.info("P2P-Listener", "[PC] Hot-swap complete. Closing old connection.");
        upstreamPcRef.current.close();
        upstreamPcRef.current = pc;
        pendingUpstreamPcRef.current = null;
      } else if (!upstreamPcRef.current) {
        upstreamPcRef.current = pc;
      }

      reconnectAttemptsRef.current = 0;
      upstreamTargetIdRef.current = targetId;
      setUpstreamTargetId(targetId);

      if (event.streams[0]) {
        const stream = event.streams[0];
        downstreamPcsRef.current.forEach((childPc) => {
          const senders = childPc.getSenders();
          stream.getTracks().forEach((track) => {
            const existingSender = senders.find(s => s.track?.kind === track.kind);
            if (existingSender) {
              existingSender.replaceTrack(track).catch(e => console.warn("Failed to replace relay track", e));
            } else {
              childPc.addTrack(track, stream);
            }
          });
        });
      }

      if (audioElementRef.current && event.streams[0]) {
        audioElementRef.current.srcObject = event.streams[0];
        // Keep muted — the element is a stream keep-alive, not an audio output.
        // All audible output goes through the Web Audio spatial graph.
        audioElementRef.current.play().catch((e) => logger.warn("P2P-Listener", "Audio auto-play blocked", e));
        setAudioStream(event.streams[0]);
        if (statusRef.current === "CONNECTING") {
          setStatus("LISTENING");
          if (signalerRef.current?.publicKey) {
            eventBus.emit('listener_joined', { nodeId: signalerRef.current.publicKey, channelId: targetId });
          }
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        logger.info("P2P-Listener", "[PC] Upstream disconnected.");
        pc.close();

        if (signalerRef.current?.publicKey) {
          eventBus.emit('listener_left', { nodeId: signalerRef.current.publicKey });
        }

        if (upstreamPcRef.current === pc) {
          upstreamPcRef.current = null;
          upstreamTargetIdRef.current = null;
          setUpstreamTargetId(null);
          if (statusRef.current === "LISTENING") {
            setStatus("CONNECTING");
          }
          if (audioElementRef.current) audioElementRef.current.srcObject = null;
          setAudioStream(null);
        } else if (pendingUpstreamPcRef.current === pc) {
          pendingUpstreamPcRef.current = null;
        }
      }
    };

    if (!upstreamPcRef.current && !pendingUpstreamPcRef.current) {
      upstreamPcRef.current = pc;
    }

    return pc;
  };

  const createDownstreamConnection = (
    targetId: string,
    stream: MediaStream | null,
    signaler: NostrSignaler,
  ): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(signaler, targetId, event.candidate);
      }
    };

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onconnectionstatechange = () => {
      logger.info("P2P-Listener", `[PC] Downstream child state (${targetId}):`, pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        pc.close();
        downstreamPcsRef.current.delete(targetId);
        setActivePeers(downstreamPcsRef.current.size);
      }
    };

    downstreamPcsRef.current.set(targetId, pc);
    setActivePeers(downstreamPcsRef.current.size);
    return pc;
  };

  const audioStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    audioStreamRef.current = audioStream;

    // Update the cached role — the beacon will publish it on the next 30s tick.
    // No immediate publish: avoids relay rate-limits during the handshake window.
    if (signalerRef.current && lastReportedLatentRef.current) {
      signalerRef.current.updatePresenceData(
        audioStream ? "relay" : "observer",
        lastReportedLatentRef.current,
        downstreamPcsRef.current.size,
        10
      );
    }
  }, [audioStream]);

  const startListening = async (targetNodeId?: string) => {
    if (status === "LISTENING" && upstreamTargetIdRef.current === targetNodeId) return;

    if (targetNodeId && signalerRef.current) {
      logger.info("P2P-Listener", `Explicitly tuning into broadcast: ${targetNodeId}`);

      const signaler = signalerRef.current;

      if (upstreamPcRef.current && upstreamTargetIdRef.current !== targetNodeId) {
        const swapPc = createUpstreamConnection(targetNodeId, signaler);
        pendingUpstreamPcRef.current = swapPc;
        const offer = await swapPc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await swapPc.setLocalDescription(offer);
        emitDescription(signaler, targetNodeId, offer);
        // Show "Negotiating Phase..." until ontrack fires
        setStatus("CONNECTING");
        statusRef.current = "CONNECTING";
      } else if (!upstreamPcRef.current) {
        upstreamTargetIdRef.current = targetNodeId;
        setUpstreamTargetId(targetNodeId);
        const pc = createUpstreamConnection(targetNodeId, signaler);
        upstreamPcRef.current = pc;
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        emitDescription(signaler, targetNodeId, offer);
        // Show "Negotiating Phase..." until ontrack fires
        setStatus("CONNECTING");
        statusRef.current = "CONNECTING";
      } else {
        // Already connected to this node — confirm tuned-in state
        setStatus("LISTENING");
      }
    }


  };

  // Track stale root IDs that failed to produce a connection
  const triedPeersRef = useRef<Set<string>>(new Set());

  const startAmbientListening = async (targetNodeId: string) => {
    if (!signalerRef.current || upstreamPcRef.current) return;

    logger.info("P2P-Listener", `Initializing ambient connection to: ${targetNodeId}`);
    upstreamTargetIdRef.current = targetNodeId;
    setUpstreamTargetId(targetNodeId);

    const pc = createUpstreamConnection(targetNodeId, signalerRef.current);
    upstreamPcRef.current = pc;
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    emitDescription(signalerRef.current, targetNodeId, offer);

    // Timeout: if no track arrives within 15s, this root is likely dead.
    // Clean up and let the auto-connect pick a different root.
    setTimeout(() => {
      if (upstreamPcRef.current === pc && !audioStreamRef.current) {
        logger.warn("P2P-Listener", `Connection to ${targetNodeId.slice(0, 8)} timed out — marking as stale`);
        triedPeersRef.current.add(targetNodeId);
        pc.close();
        upstreamPcRef.current = null;
        upstreamTargetIdRef.current = null;
        setUpstreamTargetId(null);
      }
    }, 15_000);
  };

  // Auto-connect to nearest broadcast node for ambient audio
  useEffect(() => {
    if (status === "AMBIENT" && !upstreamPcRef.current && globalPeerMap.length > 0) {
      const possibleNodes = globalPeerMap
        .filter(p => (p.role === "root" || p.role === "relay") && !triedPeersRef.current.has(p.id));

      if (possibleNodes.length > 0) {
        // Find nearest node
        const myLatent = lastReportedLatentRef.current;
        let bestNode = possibleNodes[0];

        if (myLatent) {
          let minScore = Infinity;
          for (const node of possibleNodes) {
            if (!node.latentState) continue;
            const distSq = Math.pow(node.latentState.x - myLatent.x, 2) + Math.pow(node.latentState.y - myLatent.y, 2);
            if (distSq < minScore) {
              minScore = distSq;
              bestNode = node;
            }
          }
        }

        startAmbientListening(bestNode.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalPeerMap, status, audioStream]);

  const untuneFromBroadcast = () => {
    // Only change the audio processing mode — keep the WebRTC connection alive.
    // The connection persists for ambient audio; the user can re-tune instantly.
    setStatus("AMBIENT");
    statusRef.current = "AMBIENT";
    if (signalerRef.current?.publicKey) {
      eventBus.emit('listener_left', { nodeId: signalerRef.current.publicKey });
    }
  };

  const unlockAudio = () => {
    if (audioElementRef.current) {
      // Start playback (needed for browser activation) but keep muted —
      // audible output is handled exclusively by the Web Audio graph.
      audioElementRef.current.play().catch((e) => logger.warn("P2P-Listener", "Audio auto-play blocked", e));
    }
  };

  return {
    status,
    activePeers,
    socketId: npub, // Map npub backward compatibly to the UI
    globalPeerMap,
    dataTransferRate,
    audioStream,
    upstreamTargetId,
    startListening,
    stopListening,
    untuneFromBroadcast,
    unlockAudio,
  };
}
