"use client";

import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import { useListener } from "@/components/p2p/useListener";

export default function Home() {
  const { status, activePeers, startListening } = useListener();

  return (
    <main
      className="relative flex min-h-screen w-full flex-col bg-[#000000] overflow-hidden cursor-crosshair"
      onClick={startListening}
    >
      {/* Dynamic Noise / Grain Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Connection Status Overlay (Subtle typographic info) */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-none font-mono text-[10px] text-accent uppercase tracking-widest">
        {status === "IDLE" && <p className="animate-pulse">Awaiting Signal (Click to tune)</p>}
        {status === "CONNECTING" && <p>Negotiating Phase...</p>}
        {status === "LISTENING" && (
          <div className="flex flex-col gap-1">
            <span className="text-[#ffffff]">Resonance Stabilized</span>
            <span>Active Peers: {activePeers}</span>
          </div>
        )}
      </div>

      {/* The Simulation Field Container */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {/* Pass status down if needed later for visual changes */}
        <SimulationCanvas isActive={status === "LISTENING"} />
      </div>

    </main>
  );
}
