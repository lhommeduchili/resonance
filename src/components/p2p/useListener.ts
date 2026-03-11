"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CuratorialGraph, ListenerStatus, PeerMapEntry } from "@/lib/types";
import { useNetworkTelemetry } from "./useNetworkTelemetry";
import {
  browserP2PTransportFactory,
  type P2PTransportFactory,
} from "@/lib/p2p/transport/factory";
import { ListenerTransport } from "@/lib/p2p/transport/listenerTransport";
import { runtimeChannel } from "@/lib/runtime/channel";

export function useListener(transportFactory: P2PTransportFactory = browserP2PTransportFactory) {
  const [status, setStatus] = useState<ListenerStatus>("AMBIENT");
  const [activePeers, setActivePeers] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [npub, setNpub] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [upstreamTargetId, setUpstreamTargetId] = useState<string | null>(null);

  const transportRef = useRef<ListenerTransport | null>(null);

  const callbacks = useMemo(
    () => ({
      onStatusChange: setStatus,
      onActivePeersChange: setActivePeers,
      onGlobalPeerMapChange: setGlobalPeerMap,
      onNpubChange: setNpub,
      onAudioStreamChange: setAudioStream,
      onUpstreamTargetChange: setUpstreamTargetId,
    }),
    [],
  );

  useEffect(() => {
    const transport = new ListenerTransport(transportFactory, callbacks);
    transportRef.current = transport;
    transport.init();

    const unsubscribeLatent = runtimeChannel.subscribeLatent((update) => {
      transport.reportLatentUpdate(update.latent);
    });

    return () => {
      unsubscribeLatent();
      transport.dispose();
      transportRef.current = null;
    };
  }, [callbacks, transportFactory]);

  const { dataTransferRate } = useNetworkTelemetry(
    () => transportRef.current?.getUpstreamPeerConnection() ?? null,
    status,
  );

  const activeGraph = useMemo<CuratorialGraph | null>(() => {
    if (status !== "LISTENING" || !upstreamTargetId) return null;

    // Traverse up the tree to find the root node (broadcaster) for the current target
    // We could either find it directly (if connected to root) or just search the map for ANY root 
    // that this target belongs to. However, in our topology map, properties flow downstream, 
    // but the `activeCuratorialGraph` is currently only appended to root node entries.
    const parentNode = globalPeerMap.find((p) => p.id === upstreamTargetId);
    
    // Simplest heuristic for this PoC: 
    // Find the single root node broadcasting in the topology and return its graph.
    // Given the current limitation of the signaling layer, everyone is technically in the same realm right now.
    const rootNode = globalPeerMap.find((p) => p.role === "root");

    return rootNode?.activeCuratorialGraph ?? null;
  }, [status, upstreamTargetId, globalPeerMap]);

  return {
    status,
    activePeers,
    socketId: npub,
    globalPeerMap,
    dataTransferRate,
    audioStream,
    upstreamTargetId,
    activeGraph,
    startListening: (targetNodeId?: string) => transportRef.current?.startListening(targetNodeId),
    stopListening: () => transportRef.current?.stopListening(),
    untuneFromBroadcast: () => transportRef.current?.untuneFromBroadcast(),
    unlockAudio: () => transportRef.current?.unlockAudio(),
  };
}
