"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useListener } from "@/components/p2p/useListener";
import { useSpatialAudio } from "@/components/p2p/useSpatialAudio";
import type { SpatialData } from "@/lib/simulation/contracts";
import { eventBus } from "@/lib/eventBus";
import { logger } from "@/lib/logger";
import type { AppMessages } from "@/lib/i18n/dictionaries";
import { SubsystemErrorBoundary } from "@/components/error/SubsystemErrorBoundary";
import { SimulationFallback } from "@/components/error/SimulationFallback";
import { TransportFallback } from "@/components/error/TransportFallback";
import { SpatialOverlay } from "@/components/a11y/SpatialOverlay";
import { LiveAnnouncer } from "@/components/a11y/LiveAnnouncer";
import { buildNodeSemanticSnapshots } from "@/lib/a11y/snapshots";
import { runtimeChannel } from "@/lib/runtime/channel";
import { AttributionBridge } from "@/components/poc/AttributionBridge";

const SimulationCanvas = dynamic(
  () => import("@/components/simulation/SimulationCanvas").then((mod) => mod.SimulationCanvas),
  { ssr: false },
);

export function HomeScreen({ messages }: { messages: AppMessages }) {
  const [transportEpoch, setTransportEpoch] = useState(0);

  return (
    <SubsystemErrorBoundary
      subsystem="transport"
      fallback={({ reset }) => (
        <TransportFallback
          title={messages.system.transportDriftTitle}
          message={messages.system.transportDriftMessage}
          actionLabel={messages.system.reconnectChannel}
          onRetry={() => {
            setTransportEpoch((prev) => prev + 1);
            reset();
          }}
        />
      )}
    >
      <HomeScreenRuntime key={transportEpoch} messages={messages} />
    </SubsystemErrorBoundary>
  );
}

function HomeScreenRuntime({ messages }: { messages: AppMessages }) {
  const [simulationEpoch, setSimulationEpoch] = useState(0);
  const [overlayRuntime, setOverlayRuntime] = useState({
    distanceToNode: Infinity,
    viewport: { width: 0, height: 0, zoomScalar: 1 },
  });
  const {
    status,
    activePeers,
    socketId,
    globalPeerMap,
    dataTransferRate,
    audioStream,
    upstreamTargetId,
    activeGraph,
    startListening,
    untuneFromBroadcast,
    unlockAudio,
  } = useListener();
  const [isAudioReady, setIsAudioReady] = useState(false);

  const spatialDataRef = useRef<SpatialData>({
    distanceToNode: Infinity,
    pan: 0,
    isActive: false,
    latent: { x: 0, y: 0, spin: 0 },
    hoveredNodeId: null,
    viewport: { width: 0, height: 0, zoomScalar: 1 },
  });

  const { initAudio, resumeAudio } = useSpatialAudio(audioStream, spatialDataRef);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentSpatial = spatialDataRef.current;
      const currentLatent = currentSpatial?.latent;

      setOverlayRuntime({
        distanceToNode: currentSpatial?.distanceToNode ?? Infinity,
        viewport: currentSpatial?.viewport ?? { width: 0, height: 0, zoomScalar: 1 },
      });

      if (currentLatent) {
        runtimeChannel.publishLatent({
          latent: currentLatent,
          timestamp: Date.now(),
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const nodeSnapshots = buildNodeSemanticSnapshots(globalPeerMap, upstreamTargetId);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    const bindLog = (eventName: Parameters<typeof eventBus.on>[0]) => {
      const handler = (payload: unknown) => {
        logger.debug("ui", `Event bus observed ${eventName}`, payload);
      };
      eventBus.on(eventName, handler);
      unsubscribers.push(() => eventBus.off(eventName, handler));
    };

    bindLog("listener_joined");
    bindLog("listener_left");
    bindLog("relay_selected");
    bindLog("broadcast_started");
    bindLog("broadcast_ended");
    bindLog("curation_support_changed");

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  return (
    <main
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#000000] cursor-crosshair"
      onClick={() => {
        if (!isAudioReady) return;

        const hoveredNodeId = spatialDataRef.current?.hoveredNodeId;
        if (!hoveredNodeId) return;

        if (status === "LISTENING" && upstreamTargetId === hoveredNodeId) {
          untuneFromBroadcast();
        } else {
          startListening(hoveredNodeId);
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />

      {!isAudioReady && (
        <div
          className="absolute inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/40"
          onClick={(event) => {
            event.stopPropagation();
            initAudio();
            resumeAudio();
            unlockAudio();
            setIsAudioReady(true);
          }}
        >
          <p className="animate-pulse font-mono text-xs uppercase tracking-widest text-[#ffffff] opacity-70">
            {messages.home.openChannel}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 left-6 z-20 font-mono text-[10px] uppercase tracking-widest text-accent">
        {status === "AMBIENT" && (
          <p className="animate-pulse opacity-50">{messages.home.explorationPhase}</p>
        )}
        {status === "CONNECTING" && (
          <p className="opacity-70 transition-opacity duration-1000">
            {messages.home.negotiatingPhase}
          </p>
        )}
        {status === "LISTENING" && (
          <div className="flex animate-in flex-col gap-1 fade-in duration-[9000ms]">
            <span data-testid="signal-locked-status" className="text-[#ffffff]">
              {messages.home.signalLocked}
            </span>
            {activeGraph && (
              <div className="mt-2 text-[9px] text-accent/80 flex flex-col gap-1">
                <span>[ CHANNEL ] {activeGraph.name}</span>
                <span className="opacity-50 break-words max-w-[200px]">{activeGraph.tags.join(" • ")}</span>
              </div>
            )}
          </div>
        )}
        <div className="mt-1 opacity-50">
          {messages.home.activePeersLabel}: {activePeers}
        </div>
      </div>

      <SubsystemErrorBoundary
        subsystem="simulation"
        fallback={({ reset }) => (
          <SimulationFallback
            title={messages.system.simulationDriftTitle}
            message={messages.system.simulationDriftMessage}
            actionLabel={messages.system.resyncField}
            onRetry={() => {
              setSimulationEpoch((prev) => prev + 1);
              reset();
            }}
          />
        )}
      >
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <SimulationCanvas
            key={simulationEpoch}
            isActive={status === "LISTENING"}
            isListener={true}
            dataTransferRate={dataTransferRate}
            spatialDataRef={spatialDataRef}
            globalPeerMap={globalPeerMap}
            socketId={socketId}
            connectedNodeId={upstreamTargetId}
            isReady={isAudioReady}
          />
        </div>
      </SubsystemErrorBoundary>

      <SpatialOverlay
        nodes={nodeSnapshots}
        messages={messages}
        onFocusNode={(nodeId) => {
          if (spatialDataRef.current) {
            spatialDataRef.current.hoveredNodeId = nodeId;
          }
        }}
        onTuneNode={(nodeId) => {
          startListening(nodeId);
        }}
        onUntuneNode={() => {
          untuneFromBroadcast();
        }}
        viewport={overlayRuntime.viewport}
      />
      <LiveAnnouncer
        messages={messages}
        status={status}
        distanceToNode={overlayRuntime.distanceToNode}
        isAudioReady={isAudioReady}
      />
      <AttributionBridge />
    </main>
  );
}
