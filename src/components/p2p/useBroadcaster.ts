"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BroadcasterStatus, PeerMapEntry, CuratorialGraph } from "@/lib/types";
import { type AudioProfileMode, DEFAULT_AUDIO_PROFILE } from "@/lib/audio/profiles";
import {
  browserP2PTransportFactory,
  type P2PTransportFactory,
} from "@/lib/p2p/transport/factory";
import { BroadcasterTransport } from "@/lib/p2p/transport/broadcasterTransport";
import { logger } from "@/lib/logger";

export function useBroadcaster(
  curatorialGraphs: CuratorialGraph[],
  transportFactory: P2PTransportFactory = browserP2PTransportFactory,
) {
  const [status, setStatus] = useState<BroadcasterStatus>("IDLE");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [listeners, setListeners] = useState<number>(0);
  const [globalPeerMap, setGlobalPeerMap] = useState<PeerMapEntry[]>([]);
  const [npub, setNpub] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeProfile, setActiveProfile] = useState<AudioProfileMode>(DEFAULT_AUDIO_PROFILE.id);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [selectedGraphId, setSelectedGraphId] = useState<string>(
    curatorialGraphs.length > 0 ? curatorialGraphs[0].id : "",
  );

  const transportRef = useRef<BroadcasterTransport | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const callbacks = useMemo(
    () => ({
      onStatusChange: setStatus,
      onErrorChange: setErrorDetail,
      onListenersChange: setListeners,
      onGlobalPeerMapChange: setGlobalPeerMap,
      onNpubChange: setNpub,
      onActiveStreamChange: setActiveStream,
    }),
    [],
  );

  useEffect(() => {
    previewStreamRef.current = previewStream;
  }, [previewStream]);

  useEffect(() => {
    transportRef.current = new BroadcasterTransport(transportFactory, callbacks, DEFAULT_AUDIO_PROFILE.id);

    const fetchDevices = async () => {
      try {
        const preview = await navigator.mediaDevices.getUserMedia({ audio: true });
        setPreviewStream(preview);
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((device) => device.kind === "audioinput");
        setDevices(audioInputs);
      } catch (error) {
        logger.error("P2P-Broadcaster", "Failed to enumerate devices", error);
      }
    };

    fetchDevices();

    return () => {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      transportRef.current?.dispose();
      transportRef.current = null;
    };
  }, [callbacks, transportFactory]);

  const startBroadcast = async (deviceId?: string) => {
    const graph = curatorialGraphs.find((g) => g.id === selectedGraphId) ?? curatorialGraphs[0];
    if (!graph) return;

    await transportRef.current?.startBroadcast({
      deviceId,
      profile: activeProfile,
      graph,
      onLiveStreamAcquired: () => {
        if (previewStream) {
          previewStream.getTracks().forEach((track) => track.stop());
          setPreviewStream(null);
        }
      },
    });
  };

  const stopBroadcast = () => {
    transportRef.current?.stopBroadcast();
  };

  const changeDevice = async (deviceId: string) => {
    if (status !== "LIVE") return;
    await transportRef.current?.changeDevice(deviceId);
  };

  const changeAudioProfile = async (profileId: AudioProfileMode) => {
    if (activeProfile === profileId) return;
    const previous = activeProfile;
    setActiveProfile(profileId);

    if (status !== "LIVE") return;

    try {
      await transportRef.current?.changeAudioProfile(profileId);
    } catch {
      setActiveProfile(previous);
    }
  };

  const changeSelectedGraph = (graphId: string) => {
    if (status === "LIVE" || status === "CONNECTING") {
      return;
    }
    setSelectedGraphId(graphId);
  };

  return {
    status,
    errorDetail,
    listeners,
    socketId: npub,
    globalPeerMap,
    devices,
    activeProfile,
    selectedGraphId,
    curatorialGraphs,
    activeStream,
    previewStream,
    startBroadcast,
    stopBroadcast,
    changeDevice,
    changeAudioProfile,
    setSelectedGraphId: changeSelectedGraph,
  };
}
