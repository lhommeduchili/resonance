"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
const SimulationCanvas = dynamic(
  () => import("@/components/simulation/SimulationCanvas").then((mod) => mod.SimulationCanvas),
  { ssr: false }
);
import { useListener } from "@/components/p2p/useListener";
import { useSpatialAudio } from "@/components/p2p/useSpatialAudio";
import type { SpatialData } from "@/components/simulation/usePhysicsEngine";
import { eventBus } from "@/lib/eventBus";

export default function Home() {
  const { status, activePeers, socketId, globalPeerMap, dataTransferRate, audioStream, upstreamTargetId, startListening, untuneFromBroadcast, unlockAudio } = useListener();
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Shared state connecting Physics Engine to Audio Engine
  const spatialDataRef = useRef<SpatialData>({
    distanceToNode: Infinity, pan: 0, isActive: false,
    latent: { x: 0, y: 0, spin: 0 },
    hoveredNodeId: null
  });

  // Power the localized audio physics
  const { initAudio, resumeAudio } = useSpatialAudio(audioStream, spatialDataRef);

  // Poll the physics engine purely to emit network boundary events
  // This avoids constant React re-renders while still pushing data to the network hook
  useEffect(() => {
    const interval = setInterval(() => {
      const currentLatent = spatialDataRef.current?.latent;
      if (currentLatent) {
        window.dispatchEvent(
          new CustomEvent("resonance_latent_update", { detail: currentLatent })
        );
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Global Event Bus Debug Listener (Proves Decoupling)
  useEffect(() => {
    const unsub_arr: Array<() => void> = [];

    const bindLog = (eventName: Parameters<typeof eventBus.on>[0]) => {
      const handler = (payload: unknown) => {
        console.log(`%c[EventBus] %c${eventName}`, "color: #ff00ff; font-weight: bold;", "color: #00ffff;", payload);
      };
      eventBus.on(eventName, handler);
      unsub_arr.push(() => eventBus.off(eventName, handler));
    };

    bindLog("listener_joined");
    bindLog("listener_left");
    bindLog("relay_selected");
    bindLog("broadcast_started");
    bindLog("broadcast_ended");
    bindLog("curation_support_changed");

    return () => unsub_arr.forEach(unsub => unsub());
  }, []);

  return (
    <main
      className="relative flex min-h-screen w-full flex-col bg-[#000000] overflow-hidden cursor-crosshair"
      onClick={() => {
        if (!isAudioReady) return; // Handled by overlay

        const hoveredNodeId = spatialDataRef.current?.hoveredNodeId;
        if (!hoveredNodeId) return;

        if (status === "LISTENING" && upstreamTargetId === hoveredNodeId) {
          // Clicking the currently connected node untunes the broadcast
          // but keeps the WebRTC connection alive for ambient audio
          untuneFromBroadcast();
        } else {
          // Clicking a different node tunes into it
          startListening(hoveredNodeId);
        }
      }}
    >
      {/* Dynamic Noise / Grain Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Initialization Overlay */}
      {!isAudioReady && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            initAudio();
            resumeAudio();
            unlockAudio();
            setIsAudioReady(true);
          }}
        >
          <p className="text-[#ffffff] font-mono uppercase tracking-widest text-xs animate-pulse opacity-70">
            Click anywhere to open channel
          </p>
        </div>
      )}

      {/* Connection Status Overlay (Subtle typographic info) */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-none font-mono text-[10px] text-accent uppercase tracking-widest">
        {status === "AMBIENT" && (
          <p className="animate-pulse opacity-50">Exploration Phase</p>
        )}
        {status === "CONNECTING" && (
          <p className="opacity-70 transition-opacity duration-1000">Negotiating Phase...</p>
        )}
        {status === "LISTENING" && (
          <div className="flex flex-col gap-1 animate-in fade-in duration-[9000ms]">
            <span className="text-[#ffffff]">Signal Locked.</span>
          </div>
        )}
        <div className="mt-1 opacity-50">
          State active peers: {activePeers}
        </div>
      </div>


      {/* The Simulation Field Container */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {/* Pass status down if needed later for visual changes */}
        <SimulationCanvas
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

      {/* Invisible Accessibility (A11y DOM Mirror) */}
      <div className="sr-only" aria-live="polite">
        <h2>Active Broadcast Nodes</h2>
        {globalPeerMap
          .filter((peer) => peer.role === "root" || peer.role === "relay")
          .map((peer) => {
            const isTuned = status === "LISTENING" && upstreamTargetId === peer.id;
            return (
              <button
                key={peer.id}
                onFocus={() => {
                  if (spatialDataRef.current) {
                    spatialDataRef.current.hoveredNodeId = peer.id;
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTuned) {
                    untuneFromBroadcast();
                  } else {
                    startListening(peer.id);
                  }
                }}
                aria-pressed={isTuned}
              >
                {isTuned ? "Disconnect from" : "Tune into"} Broadcast Node {peer.id.slice(0, 4)}
              </button>
            );
          })}
      </div>

    </main>
  );
}
