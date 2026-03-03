"use client";

import { useBroadcaster } from "@/components/p2p/useBroadcaster";
import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import { AudioWaveform } from "@/components/simulation/AudioWaveform";
import { useState, useRef } from "react";
import type { SpatialData } from "@/components/simulation/usePhysicsEngine";

export default function BroadcastTerminal() {
  const {
    status,
    listeners,
    devices,
    socketId,
    globalPeerMap,
    activeStream,
    activeProfile,
    previewStream,
    startBroadcast,
    stopBroadcast,
    changeDevice,
    changeAudioProfile,
  } = useBroadcaster();
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  // Broadcast terminal doesn't need audio spatial panning locally, but Canvas needs the ref
  const spatialDataRef = useRef<SpatialData>({
    distanceToNode: Infinity,
    pan: 0,
    isActive: false,
    latent: { x: 0, y: 0, spin: 0 },
    hoveredNodeId: null,
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6 bg-[#000000] overflow-hidden">
      {/* The Background Resonance Field */}
      <div className="absolute inset-0 z-0 opacity-40">
        <SimulationCanvas
          isActive={status === "LIVE"}
          spatialDataRef={spatialDataRef}
          globalPeerMap={globalPeerMap}
          socketId={socketId}
        />
      </div>

      {/* The Translucent Broadcaster Terminal */}
      <div className="relative z-10 w-full max-w-lg border border-accent p-8 font-mono text-sm leading-relaxed bg-black/10 backdrop-blur-[6px] shadow-2xl">
        <header className="mb-8 border-b border-accent pb-4 flex flex-col items-center text-center">
          <h1 className="text-xl font-bold tracking-widest text-[#ffffff]">
            ✧ RESONANCE INGESTION ✧
          </h1>
          <p className="text-highlight mt-2 uppercase text-xs">
            BROADCAST NODE CONFIGURATION
          </p>
        </header>

        <section className="space-y-6">
          <div className="space-y-1">
            <span className="block text-accent uppercase tracking-widest text-xs mb-1">
              Transmission Mode:
            </span>
            <div className="flex border border-accent rounded overflow-hidden">
              <button
                className={`flex-1 py-2 text-xs uppercase tracking-widest transition-colors ${activeProfile === "VOICE"
                  ? "bg-foreground text-black font-bold"
                  : "bg-black/40 text-accent hover:bg-black/60"
                  }`}
                onClick={() => changeAudioProfile("VOICE")}
              >
                [ Voice ]
              </button>
              <button
                className={`flex-1 py-2 text-xs uppercase tracking-widest transition-colors ${activeProfile === "HIGH_FIDELITY"
                  ? "bg-foreground text-black font-bold"
                  : "bg-black/40 text-accent hover:bg-black/60"
                  }`}
                onClick={() => changeAudioProfile("HIGH_FIDELITY")}
              >
                [ High-Fidelity ]
              </button>
            </div>
          </div>

          <div>
            <span className="block text-accent uppercase tracking-widest text-xs mb-1">
              State:
            </span>
            <span
              className={`uppercase font-bold ${status === "LIVE" ? "text-green-500" : "text-foreground"}`}
            >
              [ {status} ]
            </span>
          </div>

          <div>
            <span className="block text-accent uppercase tracking-widest text-xs mb-1">
              Direct Peers:
            </span>
            <span className="text-foreground">{listeners} / ∞</span>
          </div>

          {/* Telemetry Waveform - Shows preview before live, live stream after ignition */}
          <div className="space-y-1">
            <span className="block text-accent uppercase tracking-widest text-xs mb-1">
              Telemetry:
            </span>
            <AudioWaveform stream={activeStream ?? previewStream} />
          </div>



          {devices.length > 0 && (
            <div className="space-y-1">
              <label
                htmlFor="audioSource"
                className="block text-accent uppercase tracking-widest text-xs mb-1"
              >
                Audio Source:
              </label>
              <select
                id="audioSource"
                className="w-full bg-black/60 border border-accent p-3 text-foreground uppercase text-xs focus:outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
                value={selectedDevice}
                onChange={(e) => {
                  const newDeviceId = e.target.value;
                  setSelectedDevice(newDeviceId);
                  if (status === "LIVE") {
                    changeDevice(newDeviceId);
                  }
                }}
              >
                <option value="">Default Environment</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label ||
                      `Microphone ${device.deviceId.substring(0, 5)}...`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {status === "IDLE" || status === "ERROR" ? (
            <div className="pt-6">
              <button
                onClick={() => startBroadcast(selectedDevice)}
                className="w-full border border-foreground hover:bg-foreground hover:text-black py-4 uppercase tracking-widest transition-colors cursor-pointer"
              >
                Ignite Transmission
              </button>
            </div>
          ) : (
            <div className="pt-6">
              <button
                onClick={stopBroadcast}
                className="w-full border border-red-900 text-red-500 hover:bg-red-900 hover:text-white py-4 uppercase tracking-widest transition-colors cursor-pointer"
              >
                Collapse Signal
              </button>
            </div>
          )}

          {status === "ERROR" && (
            <p className="text-red-500 text-xs mt-2 text-center uppercase">
              Microphone access denied or server offline.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
