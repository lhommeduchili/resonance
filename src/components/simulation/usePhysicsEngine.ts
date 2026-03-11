"use client";

import { useEffect, useRef } from "react";
import type { PeerMapEntry } from "@/lib/types";
import type {
  SimulationConfig,
  SimulationEngineAdapter,
  SimulationRuntimeAdapter,
  SpatialData,
} from "@/lib/simulation/contracts";
import { createSimulationEngine } from "@/lib/simulation/engine";
import { renderSimulationFrame } from "@/lib/simulation/renderer";

export type { Agent, SpatialData } from "@/lib/simulation/contracts";

export function usePhysicsEngine(
  isActive: boolean,
  isListener: boolean,
  dataTransferRate: number,
  spatialDataRef: React.MutableRefObject<SpatialData>,
  connectedNodeId: string | null,
  isReady = true,
  activeProfile = "VOICE",
): SimulationRuntimeAdapter {
  const configRef = useRef<SimulationConfig>({
    isActive,
    isListener,
    dataTransferRate,
    connectedNodeId,
    isReady,
    activeProfile,
  });

  const engineRef = useRef<SimulationEngineAdapter>(
    createSimulationEngine({
      isActive,
      isListener,
      dataTransferRate,
      connectedNodeId,
      isReady,
      activeProfile,
    }),
  );

  useEffect(() => {
    const nextConfig: SimulationConfig = {
      isActive,
      isListener,
      dataTransferRate,
      connectedNodeId,
      isReady,
      activeProfile,
    };
    configRef.current = nextConfig;
    engineRef.current.setConfig(nextConfig);
  }, [isActive, isListener, dataTransferRate, connectedNodeId, isReady, activeProfile]);

  const updatePeers = (peerMap: PeerMapEntry[], socketId?: string | null) => {
    engineRef.current.updatePeers(peerMap, socketId);
  };

  const handleMouseMove = (x: number, y: number) => {
    engineRef.current.handleMouseMove(x, y);
  };

  const handleClick = (hoveredNodeId: string | null) => {
    engineRef.current.handleClick(hoveredNodeId);
  };

  const tick = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    deltaMs: number,
  ) => {
    const frame = engineRef.current.step(deltaMs, width, height);
    const hoveredNodeId = renderSimulationFrame(ctx, frame);

    const selfAgent = frame.agents.find((agent) => agent.id === frame.selfId);
    if (!selfAgent) {
      return;
    }

    const targetNode =
      frame.agents.find((agent) => agent.id === configRef.current.connectedNodeId) ||
      frame.agents.find((agent) => agent.type === "node");

    if (targetNode) {
      const dx = targetNode.x - selfAgent.x;
      const dy = targetNode.y - selfAgent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      spatialDataRef.current = {
        distanceToNode: dist,
        pan: dx / width,
        isActive: configRef.current.isActive,
        latent: { x: selfAgent.x, y: selfAgent.y, spin: selfAgent.spin },
        hoveredNodeId,
        viewport: { width, height, zoomScalar: frame.zoomScalar },
      };
      return;
    }

    spatialDataRef.current = {
      distanceToNode: Infinity,
      pan: 0,
      isActive: false,
      latent: { x: selfAgent.x, y: selfAgent.y, spin: selfAgent.spin },
      hoveredNodeId,
      viewport: { width, height, zoomScalar: frame.zoomScalar },
    };
  };

  return { tick, handleMouseMove, handleClick, updatePeers };
}
