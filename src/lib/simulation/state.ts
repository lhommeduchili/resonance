import type { Agent, SimulationConfig, SimulationMouseState } from "@/lib/simulation/contracts";
import type { PeerMapEntry } from "@/lib/types";

export type SimulationEngineState = {
  config: SimulationConfig;
  agents: Agent[];
  selfId: string;
  mouse: SimulationMouseState;
  lastSocketId: string | null;
  lastPeerMap: PeerMapEntry[];
  time: number;
  transitionScalar: number;
  zoomScalar: number;
  prevIsActive: boolean;
  interactionDecayMs: number;
};

export function createInitialSimulationState(config: SimulationConfig): SimulationEngineState {
  return {
    config,
    agents: [],
    selfId: "self",
    mouse: {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      isAnchored: false,
      anchorX: 0,
      anchorY: 0,
      isInteracting: false,
    },
    lastSocketId: null,
    lastPeerMap: [],
    time: 0,
    transitionScalar: 0,
    zoomScalar: 0.1,
    prevIsActive: config.isActive,
    interactionDecayMs: 0,
  };
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
