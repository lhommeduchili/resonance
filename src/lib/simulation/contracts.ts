import type { PeerMapEntry } from "@/lib/types";

export type AgentType = "listener" | "node";

export type Agent = {
  id: string;
  type: AgentType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  spinVelocity: number;
  mass: number;
  energy: number;
  pulsePhase: number;
  life?: number;
};

export type SpatialData = {
  distanceToNode: number;
  pan: number;
  isActive: boolean;
  latent: { x: number; y: number; spin: number };
  hoveredNodeId: string | null;
  viewport: { width: number; height: number; zoomScalar: number };
};

export type SimulationMouseState = {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  isAnchored: boolean;
  anchorX: number;
  anchorY: number;
  isInteracting: boolean;
};

export type SimulationConfig = {
  isActive: boolean;
  isListener: boolean;
  dataTransferRate: number;
  connectedNodeId: string | null;
  isReady: boolean;
  activeProfile: string;
};

export type SimulationFrameState = {
  agents: Agent[];
  selfId: string;
  mouse: SimulationMouseState;
  width: number;
  height: number;
  time: number;
  zoomScalar: number;
  transitionScalar: number;
  config: SimulationConfig;
};

export interface SimulationEngineAdapter {
  setConfig(config: SimulationConfig): void;
  updatePeers(peerMap: PeerMapEntry[], socketId?: string | null): void;
  handleMouseMove(x: number, y: number): void;
  handleClick(hoveredNodeId: string | null): void;
  step(deltaMs: number, width: number, height: number): SimulationFrameState;
}

export interface SimulationRuntimeAdapter {
  tick(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    deltaMs: number,
  ): void;
  handleMouseMove(x: number, y: number): void;
  handleClick(hoveredNodeId: string | null): void;
  updatePeers(peerMap: PeerMapEntry[], socketId?: string | null): void;
}
