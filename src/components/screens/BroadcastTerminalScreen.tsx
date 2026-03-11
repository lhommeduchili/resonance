"use client";

import { useEffect, useRef, useState } from "react";
import { useBroadcaster } from "@/components/p2p/useBroadcaster";
import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import { AudioWaveform } from "@/components/simulation/AudioWaveform";
import type { SpatialData } from "@/lib/simulation/contracts";
import type { AppMessages } from "@/lib/i18n/dictionaries";
import { SubsystemErrorBoundary } from "@/components/error/SubsystemErrorBoundary";
import { SimulationFallback } from "@/components/error/SimulationFallback";
import { TransportFallback } from "@/components/error/TransportFallback";
import { AttributionBridge } from "@/components/poc/AttributionBridge";

import type { CuratorialGraph } from "@/lib/types";

function formatMessage(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template,
  );
}

export function BroadcastTerminalScreen({
  messages,
  curatorialGraphs,
}: {
  messages: AppMessages;
  curatorialGraphs: CuratorialGraph[];
}) {
  const [transportEpoch, setTransportEpoch] = useState(0);

  return (
    <SubsystemErrorBoundary
      subsystem="transport"
      fallback={({ reset }) => (
        <TransportFallback
          title={messages.system.broadcastTransportFaultTitle}
          message={messages.system.broadcastTransportFaultMessage}
          actionLabel={messages.system.reconnectChannel}
          onRetry={() => {
            setTransportEpoch((prev) => prev + 1);
            reset();
          }}
        />
      )}
    >
      <BroadcastTerminalRuntime
        key={transportEpoch}
        messages={messages}
        curatorialGraphs={curatorialGraphs}
      />
    </SubsystemErrorBoundary>
  );
}

function BroadcastTerminalRuntime({
  messages,
  curatorialGraphs: dbGraphs,
}: {
  messages: AppMessages;
  curatorialGraphs: CuratorialGraph[];
}) {
  const [simulationEpoch, setSimulationEpoch] = useState(0);
  const [ignitionPhase, setIgnitionPhase] = useState<"idle" | "priming" | "stabilizing">("idle");
  const ignitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    status,
    errorDetail,
    listeners,
    devices,
    socketId,
    globalPeerMap,
    activeStream,
    activeProfile,
    selectedGraphId,
    curatorialGraphs,
    previewStream,
    startBroadcast,
    stopBroadcast,
    changeDevice,
    changeAudioProfile,
    setSelectedGraphId,
  } = useBroadcaster(dbGraphs);
  const [selectedDevice, setSelectedDevice] = useState("");

  const spatialDataRef = useRef<SpatialData>({
    distanceToNode: Infinity,
    pan: 0,
    isActive: false,
    latent: { x: 0, y: 0, spin: 0 },
    hoveredNodeId: null,
    viewport: { width: 0, height: 0, zoomScalar: 1 },
  });

  useEffect(() => {
    return () => {
      if (ignitionTimerRef.current) {
        clearTimeout(ignitionTimerRef.current);
      }
    };
  }, []);

  const startIgnition = async () => {
    if (status === "LIVE" || ignitionPhase !== "idle") return;

    setIgnitionPhase("priming");
    ignitionTimerRef.current = setTimeout(() => {
      setIgnitionPhase("stabilizing");
      ignitionTimerRef.current = setTimeout(async () => {
        await startBroadcast(selectedDevice);
        setIgnitionPhase("idle");
      }, 1100);
    }, 900);
  };

  const isIgniting = ignitionPhase !== "idle";
  const ignitionLabel =
    ignitionPhase === "priming"
      ? messages.broadcast.ignitionPriming
      : ignitionPhase === "stabilizing"
        ? messages.broadcast.ignitionStabilizing
        : messages.broadcast.igniteTransmission;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#000000] p-6">
      <AttributionBridge />
      <SubsystemErrorBoundary
        subsystem="simulation"
        fallback={({ reset }) => (
          <SimulationFallback
            title={messages.system.broadcastSimulationDriftTitle}
            message={messages.system.broadcastSimulationDriftMessage}
            actionLabel={messages.system.resyncField}
            onRetry={() => {
              setSimulationEpoch((prev) => prev + 1);
              reset();
            }}
          />
        )}
      >
        <div className="absolute inset-0 z-0 opacity-40">
          <SimulationCanvas
            key={simulationEpoch}
            isActive={status === "LIVE"}
            spatialDataRef={spatialDataRef}
            globalPeerMap={globalPeerMap}
            socketId={socketId}
          />
        </div>
      </SubsystemErrorBoundary>

      <div className="relative z-10 w-full max-w-xl border border-accent bg-black/20 p-8 font-mono text-sm leading-relaxed shadow-2xl backdrop-blur-[6px]">
        <header className="mb-8 flex flex-col items-center border-b border-accent pb-4 text-center">
          <h1 className="text-xl font-bold tracking-widest text-[#ffffff]">
            {messages.broadcast.heading}
          </h1>
          <p className="mt-2 text-xs uppercase text-highlight">{messages.broadcast.subtitle}</p>
        </header>

        <section className="space-y-6">
          <div className="space-y-1">
            <label
              htmlFor="graphSource"
              className="mb-1 block text-xs uppercase tracking-widest text-accent"
            >
              {messages.broadcast.channelSource}
            </label>
            <select
              id="graphSource"
              className="w-full cursor-pointer appearance-none border border-accent bg-black/60 p-3 text-xs uppercase text-foreground transition-colors focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              value={selectedGraphId}
              disabled={status === "LIVE" || isIgniting}
              onChange={(event) => {
                setSelectedGraphId(event.target.value);
              }}
            >
              {curatorialGraphs.map((graph) => (
                <option key={graph.id} value={graph.id}>
                  {graph.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <span className="mb-1 block text-xs uppercase tracking-widest text-accent">
              {messages.broadcast.transmissionMode}
            </span>
            <div className="flex overflow-hidden rounded border border-accent">
              <button
                disabled={isIgniting}
                className={`flex-1 cursor-pointer py-2 text-xs uppercase tracking-widest transition-colors ${
                  activeProfile === "VOICE"
                    ? "bg-foreground font-bold text-black"
                    : "bg-black/40 text-accent hover:bg-black/60"
                }`}
                onClick={() => changeAudioProfile("VOICE")}
              >
                [ {messages.broadcast.voiceMode} ]
              </button>
              <button
                disabled={isIgniting}
                className={`flex-1 cursor-pointer py-2 text-xs uppercase tracking-widest transition-colors ${
                  activeProfile === "HIGH_FIDELITY"
                    ? "bg-foreground font-bold text-black"
                    : "bg-black/40 text-accent hover:bg-black/60"
                }`}
                onClick={() => changeAudioProfile("HIGH_FIDELITY")}
              >
                [ {messages.broadcast.highFidelityMode} ]
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1 block text-xs uppercase tracking-widest text-accent">
              {messages.broadcast.state}
            </span>
            <span
              className={`font-bold uppercase ${status === "LIVE" ? "text-green-500" : "text-foreground"}`}
            >
              [ {status} ]
            </span>
          </div>

          <div>
            <span className="mb-1 block text-xs uppercase tracking-widest text-accent">
              {messages.broadcast.directPeers}
            </span>
            <span className="text-foreground">{listeners} / ∞</span>
          </div>

          <div className="space-y-1">
            <span className="mb-1 block text-xs uppercase tracking-widest text-accent">
              {messages.broadcast.telemetry}
            </span>
            <AudioWaveform stream={activeStream ?? previewStream} />
          </div>

          {devices.length > 0 && (
            <div className="space-y-1">
              <label
                htmlFor="audioSource"
                className="mb-1 block text-xs uppercase tracking-widest text-accent"
              >
                {messages.broadcast.audioSource}
              </label>
              <select
                id="audioSource"
                className="w-full cursor-pointer appearance-none border border-accent bg-black/60 p-3 text-xs uppercase text-foreground transition-colors focus:border-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                value={selectedDevice}
                disabled={isIgniting}
                onChange={(event) => {
                  const newDeviceId = event.target.value;
                  setSelectedDevice(newDeviceId);
                  if (status === "LIVE") {
                    changeDevice(newDeviceId);
                  }
                }}
              >
                <option value="">{messages.broadcast.defaultEnvironment}</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label ||
                      formatMessage(messages.broadcast.microphoneFallback, {
                        id: device.deviceId.substring(0, 5),
                      })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {status === "IDLE" || status === "ERROR" ? (
            <div className="pt-6">
              <button
                onClick={startIgnition}
                disabled={isIgniting}
                className="w-full cursor-pointer border border-foreground py-4 uppercase tracking-widest transition-colors hover:bg-foreground hover:text-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                {ignitionLabel}
              </button>
            </div>
          ) : (
            <div className="pt-6">
              <button
                onClick={stopBroadcast}
                className="w-full cursor-pointer border border-red-900 py-4 uppercase tracking-widest text-red-500 transition-colors hover:bg-red-900 hover:text-white"
              >
                {messages.broadcast.collapseSignal}
              </button>
            </div>
          )}

          {status === "ERROR" && (
            <div className="mt-2 flex flex-col items-center text-center text-xs text-red-500">
              <span className="mb-1 uppercase font-bold">{messages.broadcast.microphoneDenied}</span>
              <span className="font-mono opacity-70">
                &quot;{errorDetail || messages.broadcast.unknownError}&quot;
              </span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
