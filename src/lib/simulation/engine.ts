import { OUTER_HALO_RADIUS } from "@/lib/physicsConstants";
import { applyForcesAndKinematics } from "@/lib/physics/forces";
import type {
  Agent,
  SimulationConfig,
  SimulationEngineAdapter,
  SimulationFrameState,
} from "@/lib/simulation/contracts";
import { reconcilePeerAgents } from "@/lib/simulation/reconcilePeers";
import {
  createInitialSimulationState,
  createSeededRandom,
  type SimulationEngineState,
} from "@/lib/simulation/state";
import type { PeerMapEntry } from "@/lib/types";

const DEFAULT_CONFIG: SimulationConfig = {
  isActive: false,
  isListener: false,
  dataTransferRate: 1,
  connectedNodeId: null,
  isReady: true,
  activeProfile: "VOICE",
};

export function createSimulationEngine(
  initialConfig: SimulationConfig = DEFAULT_CONFIG,
  seed = 1337,
): SimulationEngineAdapter {
  const state = createInitialSimulationState(initialConfig);
  const random = createSeededRandom(seed);

  const setConfig = (config: SimulationConfig) => {
    const wasActive = state.prevIsActive;
    state.config = config;

    if (config.isActive && config.connectedNodeId && !wasActive) {
      const connectedNode = state.agents.find((agent) => agent.id === config.connectedNodeId);
      const selfAgent = state.agents.find((agent) => agent.id === state.selfId);
      if (connectedNode) {
        let anchorX = connectedNode.x;
        let anchorY = connectedNode.y;
        if (selfAgent) {
          const dx = selfAgent.x - connectedNode.x;
          const dy = selfAgent.y - connectedNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            anchorX = connectedNode.x + (dx / dist) * OUTER_HALO_RADIUS;
            anchorY = connectedNode.y + (dy / dist) * OUTER_HALO_RADIUS;
          }
        }

        state.mouse.isAnchored = true;
        state.mouse.anchorX = anchorX;
        state.mouse.anchorY = anchorY;
      }
    }

    if (!config.isActive && wasActive) {
      state.mouse.isAnchored = false;
    }

    state.prevIsActive = config.isActive;
  };

  const updatePeers = (peerMap: PeerMapEntry[], socketId?: string | null) => {
    state.lastSocketId = socketId || null;
    state.lastPeerMap = peerMap;
    state.agents = reconcilePeerAgents({
      agents: state.agents,
      peerMap,
      selfId: state.selfId,
      socketId,
      random,
    });
  };

  const handleMouseMove = (x: number, y: number) => {
    state.mouse.x = x;
    state.mouse.y = y;
    state.mouse.isInteracting = true;
    state.interactionDecayMs = 1500;
  };

  const handleClick = (hoveredNodeId: string | null) => {
    if (hoveredNodeId) {
      return;
    }
    state.mouse.isAnchored = !state.mouse.isAnchored;
    state.mouse.anchorX = state.mouse.worldX;
    state.mouse.anchorY = state.mouse.worldY;
  };

  const step = (deltaMs: number, width: number, height: number): SimulationFrameState => {
    const deltaSeconds = clampDeltaSeconds(deltaMs);
    if (deltaSeconds <= 0) {
      return buildFrameState(state, width, height);
    }

    state.time += deltaSeconds;

    state.interactionDecayMs = Math.max(0, state.interactionDecayMs - deltaMs);
    if (state.interactionDecayMs === 0) {
      state.mouse.isInteracting = false;
    }

    let selfAgent = state.agents.find((agent) => agent.id === state.selfId);
    if (!selfAgent) {
      selfAgent = createSelfAgent(state.selfId, width, height, random);
      state.agents.push(selfAgent);
    }

    syncBroadcasterRootNode(state, width, height);

    if (state.config.isActive && state.transitionScalar < 1) {
      state.transitionScalar = Math.min(1, state.transitionScalar + deltaSeconds * 1.2);
    } else if (!state.config.isActive && state.transitionScalar > 0) {
      state.transitionScalar = Math.max(0, state.transitionScalar - deltaSeconds * 1.2);
    }

    if (state.config.isReady && state.zoomScalar < 1) {
      state.zoomScalar = Math.min(1, state.zoomScalar + deltaSeconds * 0.6);
    } else if (!state.config.isReady && state.zoomScalar > 0.1) {
      state.zoomScalar = Math.max(0.1, state.zoomScalar - deltaSeconds * 1.2);
    }

    state.mouse.worldX = (state.mouse.x - width / 2) / state.zoomScalar + width / 2;
    state.mouse.worldY = (state.mouse.y - height / 2) / state.zoomScalar + height / 2;

    applyForcesAndKinematics(
      state.agents,
      state.selfId,
      state.mouse,
      state.config.isActive,
      state.config.isListener,
      state.config.dataTransferRate,
      width,
      height,
      deltaSeconds,
      random,
    );

    return buildFrameState(state, width, height);
  };

  return {
    setConfig,
    updatePeers,
    handleMouseMove,
    handleClick,
    step,
  };
}

function clampDeltaSeconds(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return 0;
  }

  return Math.min(0.05, deltaMs / 1000);
}

function buildFrameState(
  state: SimulationEngineState,
  width: number,
  height: number,
): SimulationFrameState {
  return {
    agents: state.agents,
    selfId: state.selfId,
    mouse: state.mouse,
    width,
    height,
    time: state.time,
    zoomScalar: state.zoomScalar,
    transitionScalar: state.transitionScalar,
    config: state.config,
  };
}

function createSelfAgent(
  selfId: string,
  width: number,
  height: number,
  random: () => number,
): Agent {
  return {
    id: selfId,
    type: "listener",
    x: width / 2 + (random() - 0.5) * 100,
    y: height / 2 + (random() - 0.5) * 100,
    vx: 0,
    vy: 0,
    spin: random(),
    spinVelocity: 0,
    mass: 1,
    energy: 0,
    pulsePhase: 0,
  };
}

function syncBroadcasterRootNode(state: SimulationEngineState, width: number, height: number): void {
  const existingNodeIndex = state.agents.findIndex((agent) => agent.type === "node");
  if (state.config.isActive && existingNodeIndex === -1 && !state.config.isListener) {
    state.agents.push({
      id: "root-broadcast",
      type: "node",
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      spin: 0.5,
      spinVelocity: 0,
      mass: 100,
      energy: 100,
      pulsePhase: 0,
    });
    return;
  }

  if (state.config.isActive && existingNodeIndex !== -1 && !state.config.isListener) {
    const existingNode = state.agents[existingNodeIndex];
    const trackerData = state.lastPeerMap.find((peer) => peer.id === state.lastSocketId);
    if (trackerData?.energy !== undefined) {
      existingNode.energy += (trackerData.energy - existingNode.energy) * 0.1;
    }
    return;
  }

  if (!state.config.isActive && existingNodeIndex !== -1 && !state.config.isListener) {
    state.agents.splice(existingNodeIndex, 1);
  }
}
