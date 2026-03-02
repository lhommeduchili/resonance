"use client";
import { logger } from "@/lib/logger";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { LatentState, ListenerStatus, PeerMapEntry, InboundSignal } from "@/lib/types";
import { ICE_SERVERS } from "@/lib/types";
import { useNetworkTelemetry } from "./useNetworkTelemetry";
import { eventBus } from "@/lib/eventBus";
import { emitCandidate, emitDescription, applyRemoteSignal } from "@/lib/p2p/signalTransport";

export function useListener() {
  const [status, setStatus] = useState<ListenerStatus>("AMBIENT");
  const [activePeers, setActivePeers] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [upstreamTargetId, setUpstreamTargetId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const statusRef = useRef(status);
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
    // Tell server we left to close the PoC session
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("leave_broadcast");
    }
    // Do NOT null the audio stream or srcObject here.
    // We keep the audio pipeline alive so ambient audio resumes seamlessly
    // once the new upstream peer connection fires ontrack.

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
    statusRef.current = "AMBIENT"; // Force immediate sync for async closures so onTrack doesn't upgrade

    if (socketRef.current?.id) {
      eventBus.emit('listener_left', { nodeId: socketRef.current.id });
    }

    // Reconnect to the mesh as an ambient observer
    if (socketRef.current && socketRef.current.connected) {
      const latentPayload = lastReportedLatentRef.current || {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        spin: Math.random(),
      };
      requestUpstreamPeer(socketRef.current, latentPayload);
    }
  }

  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = true; // MUST be muted so the browser doesn't play raw audio bypassing WebAudio API
    audioElementRef.current = audio;
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createUpstreamConnection = (
    targetId: string,
    socket: Socket,
  ): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS as unknown as RTCIceServer[],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(socket, targetId, event.candidate);
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

      // Reset backoff counter on successful connection
      reconnectAttemptsRef.current = 0;

      upstreamTargetIdRef.current = targetId;
      setUpstreamTargetId(targetId);

      // Relay Logic: Forward this new track to all existing downstream children
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
        // Always update the stream source — ambient reconnections need this
        audioElementRef.current.srcObject = event.streams[0];
        setAudioStream(event.streams[0]);
        // Only upgrade to LISTENING if they actively clicked it;
        // otherwise, stay AMBIENT and let spatial audio map the drone
        if (statusRef.current === "CONNECTING") {
          setStatus("LISTENING");
          if (socketRef.current?.id) {
            eventBus.emit('listener_joined', { nodeId: socketRef.current.id, channelId: targetId });
          }
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        logger.info("P2P-Listener", "[PC] Upstream disconnected. Requesting new parent...");
        pc.close();

        if (socketRef.current?.id) {
          eventBus.emit('listener_left', { nodeId: socketRef.current.id });
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

          if (socket.connected) {
            const currentLatent =
              statusRef.current === "LISTENING" ||
                statusRef.current === "CONNECTING"
                ? (audioElementRef.current as HTMLAudioElement & { latentData?: { x: number; y: number; spin: number } })?.latentData || { x: 0, y: 0, spin: 0 }
                : { x: 0, y: 0, spin: 0 };

            // Exponential Backoff with Jitter
            const attempts = reconnectAttemptsRef.current;
            const backoffMs = Math.min(10000, Math.pow(2, attempts) * 1000) + Math.random() * 500;
            reconnectAttemptsRef.current += 1;

            logger.info("P2P-Listener", `[Backoff] Reconnecting to mesh in ${Math.round(backoffMs)}ms... (Attempt ${attempts + 1})`);
            setTimeout(() => {
              // Ensure socket is still connected after timeout
              if (socketRef.current && socketRef.current.connected) {
                // eslint-disable-next-line react-hooks/immutability
                requestUpstreamPeer(socketRef.current, currentLatent);
              }
            }, backoffMs);
          }
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
    socket: Socket,
  ): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(socket, targetId, event.candidate);
      }
    };

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onconnectionstatechange = () => {
      logger.info("P2P-Listener",
        `[PC] Downstream child state (${targetId}):`,
        pc.connectionState,
      );
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
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
  }, [audioStream]);

  // Connect to Tracker immediately for observing the Topology Field
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    const latentPayload = {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      spin: Math.random(),
    };
    lastReportedLatentRef.current = { ...latentPayload };

    socket.on("connect", () => {
      logger.info("P2P-Listener",
        "Connected to Tracker as Observer. Requesting ambient WebRTC connection.",
      );
      setSocketId(socket.id || null);
      requestUpstreamPeer(socket, latentPayload);
    });

    socket.on("peer_map_update", (peers: PeerMapEntry[]) => {
      setGlobalPeerMap(peers);
      setActivePeers(Math.max(0, peers.length - 1)); // We exclude ourselves
    });

    socket.on(
      "reconnect_suggestion",
      async (data: { targetPeer: { id: string } }) => {
        if (statusRef.current !== "LISTENING" || pendingUpstreamPcRef.current)
          return;
        logger.info("P2P-Listener",
          `[Re-Route] Tracker suggested better adjacent peer: ${data.targetPeer.id}. Hot-swapping...`,
        );
        const swapPc = createUpstreamConnection(data.targetPeer.id, socket);
        pendingUpstreamPcRef.current = swapPc;
        const offer = await swapPc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await swapPc.setLocalDescription(offer);
        emitDescription(socket, data.targetPeer.id, offer);
      },
    );

    socket.on(
      "signal",
      async (data: InboundSignal) => {
        const { sender, signal } = data;

        if (signal.type === "answer" && upstreamPcRef.current) {
          if (upstreamPcRef.current.signalingState === "have-local-offer") {
            await applyRemoteSignal(upstreamPcRef.current, signal)
              .catch((e) => console.warn("Failed to set remote answer:", e));
          } else {
            console.warn(
              `[PC] Ignored answer because signalingState is ${upstreamPcRef.current.signalingState}`,
            );
          }
        } else if (signal.type === "offer") {
          const currentStream = audioStreamRef.current;
          // RELAY CHANGE: We don't reject if stream is null.
          // We accept the connection, and when our upstream provides the stream,
          // we will push the tracks to this child in `pc.ontrack`.

          let childPc = downstreamPcsRef.current.get(sender);
          if (!childPc)
            childPc = createDownstreamConnection(sender, currentStream, socket);

          await applyRemoteSignal(childPc, signal);
          const answer = await childPc.createAnswer();
          await childPc.setLocalDescription(answer);
          emitDescription(socket, sender, answer);
        } else if (signal.type === "candidate") {
          if (upstreamPcRef.current && upstreamPcRef.current.remoteDescription) {
            await applyRemoteSignal(upstreamPcRef.current, signal)
              .catch((e) => console.warn(e));
          }
          const childPc = downstreamPcsRef.current.get(sender);
          if (childPc && childPc.remoteDescription) {
            await applyRemoteSignal(childPc, signal)
              .catch((e) => console.warn(e));
          }
        }
      });

    socket.on("broadcast_started", () => {
      // The Tracker will emit a map update soon anyway, which might trigger a re-route.
      // We can actively poll for a peer if we don't have one.
      if (!upstreamPcRef.current) {
        const currentLatent = lastReportedLatentRef.current || {
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          spin: Math.random(),
        };
        requestUpstreamPeer(socket, currentLatent);
      }
    });

    socket.on("disconnect", () => {
      if (statusRef.current === "LISTENING") {
        setStatus("CONNECTING");
      }
      setAudioStream(null);
      if (audioElementRef.current) audioElementRef.current.srcObject = null;
    });

    const handleLatentUpdate = (e: CustomEvent) => {
      if (!socket.connected) return;
      const newState = e.detail;
      const oldState = lastReportedLatentRef.current;

      if (oldState) {
        const distSq =
          Math.pow(newState.x - oldState.x, 2) +
          Math.pow(newState.y - oldState.y, 2);
        const spinDiff = Math.abs(newState.spin - oldState.spin);

        if (distSq > 2500 || spinDiff > 0.05) {
          socket.emit("report_state", {
            latentState: newState,
            activeConnections: downstreamPcsRef.current.size,
            currentUpstreamId: upstreamTargetIdRef.current,
          });
          lastReportedLatentRef.current = { ...newState };
        }
      } else {
        socket.emit("report_state", {
          latentState: newState,
          activeConnections: downstreamPcsRef.current.size,
          currentUpstreamId: upstreamTargetIdRef.current,
        });
        lastReportedLatentRef.current = { ...newState };
      }
    };

    window.addEventListener(
      "resonance_latent_update",
      handleLatentUpdate as EventListener,
    );

    return () => {
      socket.disconnect();
      window.removeEventListener(
        "resonance_latent_update",
        handleLatentUpdate as EventListener,
      );
    };
  }, []);

  function requestUpstreamPeer(
    socket: Socket,
    latentState: { x: number; y: number; spin: number },
  ) {
    socket.emit(
      "request_peers",
      { latentState },
      async (res: { peers: { id: string; role: string; score: number }[] }) => {
        if (res.peers && res.peers.length > 0) {
          const targetPeer = res.peers[0];
          if (!upstreamPcRef.current) {
            upstreamTargetIdRef.current = targetPeer.id;
            setUpstreamTargetId(targetPeer.id);
            const pc = createUpstreamConnection(targetPeer.id, socket);
            upstreamPcRef.current = pc;
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: false,
            });
            await pc.setLocalDescription(offer);

            eventBus.emit('relay_selected', { parentNodeId: targetPeer.id });

            emitDescription(socket, targetPeer.id, offer);
          }
        } else {
          logger.info("P2P-Listener", "No active broadcasts or network saturated.");
          setStatus("AMBIENT");
        }
      },
    );
  };

  const startListening = async (targetNodeId?: string) => {
    if (status === "LISTENING" && upstreamTargetIdRef.current === targetNodeId)
      return;

    if (targetNodeId && socketRef.current && socketRef.current.connected) {
      logger.info("P2P-Listener", `Explicitly tuning into broadcast: ${targetNodeId}`);
      if (
        upstreamPcRef.current &&
        upstreamTargetIdRef.current === targetNodeId
      ) {
        // Already connected to this peer (e.g. returning from ambient) — just re-tune
        setUpstreamTargetId(targetNodeId);
      } else if (
        upstreamPcRef.current &&
        upstreamTargetIdRef.current !== targetNodeId
      ) {
        // Hot swap to new broadcast
        const swapPc = createUpstreamConnection(
          targetNodeId,
          socketRef.current,
        );
        pendingUpstreamPcRef.current = swapPc;
        const offer = await swapPc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await swapPc.setLocalDescription(offer);
        emitDescription(socketRef.current, targetNodeId, offer);
      } else if (!upstreamPcRef.current) {
        // Direct specific connection
        upstreamTargetIdRef.current = targetNodeId;
        setUpstreamTargetId(targetNodeId);
        const pc = createUpstreamConnection(targetNodeId, socketRef.current);
        upstreamPcRef.current = pc;
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        emitDescription(socketRef.current, targetNodeId, offer);
      }
      setStatus("LISTENING");
    } else if (!targetNodeId) {
      // Auto ambient logic
      if (!upstreamPcRef.current) {
        setStatus("CONNECTING");
        const latentPayload = lastReportedLatentRef.current || {
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          spin: Math.random(),
        };
        if (socketRef.current && socketRef.current.connected) {
          requestUpstreamPeer(socketRef.current, latentPayload);
        }
      } else {
        setStatus("LISTENING");
      }
    }

    // Force playback if the browser suspended autoplay on page load
    if (audioElementRef.current) {
      audioElementRef.current
        .play()
        .catch((e) => console.warn("Audio play blocked:", e));
    }
  };


  // Soft untune: keep the WebRTC connection alive, just toggle status.
  // The audio stream stays connected and useSpatialAudio switches to ambient filtering.
  const untuneFromBroadcast = () => {
    // Tell server we left to close the PoC session
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("leave_broadcast");
    }

    setStatus("AMBIENT");
    statusRef.current = "AMBIENT";
    // Clear the UI targeting — the ref keeps the real upstream peer ID
    setUpstreamTargetId(null);
    if (socketRef.current?.id) {
      eventBus.emit('listener_left', { nodeId: socketRef.current.id });
    }
  };

  return {
    status,
    activePeers,
    socketId,
    globalPeerMap,
    dataTransferRate,
    audioStream,
    upstreamTargetId,
    startListening,
    stopListening,
    untuneFromBroadcast,
  };
}
