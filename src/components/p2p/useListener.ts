"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { LatentState, ListenerStatus, PeerMapEntry } from "@/lib/types";
import { ICE_SERVERS } from "@/lib/types";

export function useListener() {
  const [status, setStatus] = useState<ListenerStatus>("AMBIENT");
  const [activePeers, setActivePeers] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [dataTransferRate, setDataTransferRate] = useState<number>(1.0);
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "LISTENING") {
      interval = setInterval(() => {
        const jitter = Math.random() * 1.5 * Math.max(1, activePeers);
        setDataTransferRate(1.0 + jitter);
        setTimeout(() => {
          setDataTransferRate(1.0 + Math.random() * 0.2);
        }, 50);
      }, 300);
    } else {
      setDataTransferRate(1.0);
    }
    return () => clearInterval(interval);
  }, [status, activePeers]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    audio.muted = true; // MUST be muted so the browser doesn't play raw audio bypassing WebAudio API
    audioElementRef.current = audio;
    return () => stopListening();
  }, []);

  const createUpstreamConnection = (
    targetId: string,
    socket: Socket,
  ): RTCPeerConnection => {
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

    pc.ontrack = (event) => {
      console.log("[PC] Upstream track received from:", targetId);

      if (pendingUpstreamPcRef.current === pc && upstreamPcRef.current) {
        console.log("[PC] Hot-swap complete. Closing old connection.");
        upstreamPcRef.current.close();
        upstreamPcRef.current = pc;
        pendingUpstreamPcRef.current = null;
      } else if (!upstreamPcRef.current) {
        upstreamPcRef.current = pc;
      }

      upstreamTargetIdRef.current = targetId;
      setUpstreamTargetId(targetId);

      if (audioElementRef.current && event.streams[0]) {
        // Always update the stream source — ambient reconnections need this
        audioElementRef.current.srcObject = event.streams[0];
        setAudioStream(event.streams[0]);
        // Only upgrade to LISTENING if they actively clicked it;
        // otherwise, stay AMBIENT and let spatial audio map the drone
        if (statusRef.current === "CONNECTING") {
          setStatus("LISTENING");
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        console.log("[PC] Upstream disconnected. Requesting new parent...");
        pc.close();

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
                ? (audioElementRef as any).latentData || { x: 0, y: 0, spin: 0 }
                : { x: 0, y: 0, spin: 0 };
            requestUpstreamPeer(socket, currentLatent);
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
    stream: MediaStream,
    socket: Socket,
  ): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          target: targetId,
          signal: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onconnectionstatechange = () => {
      console.log(
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
      console.log(
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
        console.log(
          `[Re-Route] Tracker suggested better adjacent peer: ${data.targetPeer.id}. Hot-swapping...`,
        );
        const swapPc = createUpstreamConnection(data.targetPeer.id, socket);
        pendingUpstreamPcRef.current = swapPc;
        const offer = await swapPc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await swapPc.setLocalDescription(offer);
        socket.emit("signal", { target: data.targetPeer.id, signal: offer });
      },
    );

    socket.on("signal", async (data: { sender: string; signal: any }) => {
      const { sender, signal } = data;

      if (signal.type === "answer" && upstreamPcRef.current) {
        if (upstreamPcRef.current.signalingState === "have-local-offer") {
          await upstreamPcRef.current
            .setRemoteDescription(new RTCSessionDescription(signal))
            .catch((e) => console.warn("Failed to set remote answer:", e));
        } else {
          console.warn(
            `[PC] Ignored answer because signalingState is ${upstreamPcRef.current.signalingState}`,
          );
        }
      } else if (signal.type === "offer") {
        const currentStream = audioStreamRef.current;
        if (!currentStream) {
          console.warn(
            `[PC] Rejected downstream request from ${sender}: stream not ready.`,
          );
          return;
        }

        let childPc = downstreamPcsRef.current.get(sender);
        if (!childPc)
          childPc = createDownstreamConnection(sender, currentStream, socket);

        await childPc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await childPc.createAnswer();
        await childPc.setLocalDescription(answer);
        socket.emit("signal", { target: sender, signal: answer });
      } else if (signal.type === "candidate") {
        if (upstreamPcRef.current && upstreamPcRef.current.remoteDescription) {
          await upstreamPcRef.current
            .addIceCandidate(new RTCIceCandidate(signal.candidate))
            .catch((e) => console.warn(e));
        }
        const childPc = downstreamPcsRef.current.get(sender);
        if (childPc && childPc.remoteDescription) {
          await childPc
            .addIceCandidate(new RTCIceCandidate(signal.candidate))
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

  const requestUpstreamPeer = (
    socket: Socket,
    latentState: { x: number; y: number; spin: number },
  ) => {
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
            socket.emit("signal", { target: targetPeer.id, signal: offer });
          }
        } else {
          console.log("No active broadcasts or network saturated.");
          setStatus("AMBIENT");
        }
      },
    );
  };

  const startListening = async (targetNodeId?: string) => {
    if (status === "LISTENING" && upstreamTargetIdRef.current === targetNodeId)
      return;

    if (targetNodeId && socketRef.current && socketRef.current.connected) {
      console.log(`Explicitly tuning into broadcast: ${targetNodeId}`);
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
        socketRef.current.emit("signal", {
          target: targetNodeId,
          signal: offer,
        });
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
        socketRef.current.emit("signal", {
          target: targetNodeId,
          signal: offer,
        });
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

  const stopListening = () => {
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

    // Reconnect to the mesh as an ambient observer
    if (socketRef.current && socketRef.current.connected) {
      const latentPayload = lastReportedLatentRef.current || {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        spin: Math.random(),
      };
      requestUpstreamPeer(socketRef.current, latentPayload);
    }
  };

  // Soft untune: keep the WebRTC connection alive, just toggle status.
  // The audio stream stays connected and useSpatialAudio switches to ambient filtering.
  const untuneFromBroadcast = () => {
    setStatus("AMBIENT");
    statusRef.current = "AMBIENT";
    // Clear the UI targeting — the ref keeps the real upstream peer ID
    setUpstreamTargetId(null);
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
