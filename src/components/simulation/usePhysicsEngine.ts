"use client";

import { useEffect, useRef } from "react";
import { OUTER_HALO_RADIUS, INTERACTION_RADIUS } from "@/lib/physicsConstants";
import { applyForcesAndKinematics } from "@/lib/physics/forces";
import type { PeerMapEntry } from "@/lib/types";

export type AgentType = "listener" | "node";

export type Agent = {
  id: string;
  type: AgentType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number; // The internal state for spin-wave alignment (0 to 1) representing taste
  spinVelocity: number; // Rate of change of spin
  mass: number;
  energy: number; // Active attention/gravity pull
  pulsePhase: number; // Visual pulse sync
  life?: number; // For ambient particles
};

export type SpatialData = {
  distanceToNode: number;
  pan: number;
  isActive: boolean;
  latent: { x: number; y: number; spin: number };
  hoveredNodeId: string | null;
};

export function usePhysicsEngine(
  isActive: boolean,
  isListener: boolean,
  dataTransferRate: number,
  spatialDataRef: React.MutableRefObject<SpatialData>,
  connectedNodeId: string | null,
  isReady: boolean = true,
  activeProfile: string = "VOICE",
) {
  const stateRef = useRef({
    isActive,
    isListener,
    dataTransferRate,
    connectedNodeId,
    isReady,
    activeProfile,
  });
  const elementsRef = useRef({
    agents: [] as Agent[],
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
    lastSocketId: null as string | null,
    lastPeerMap: [] as PeerMapEntry[],
  });
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Internal timing state
  const timeRef = useRef(0);
  const transitionScalarRef = useRef(0);
  const zoomScalarRef = useRef(0.1);
  // Track connection transitions to set/clear anchor
  const prevIsActiveRef = useRef(isActive);

  // Keep react props synced to the engine's internal mutable state
  useEffect(() => {
    const wasActive = prevIsActiveRef.current;

    stateRef.current = {
      isActive,
      isListener,
      dataTransferRate,
      connectedNodeId,
      isReady,
      activeProfile,
    };

    // Connect transition: anchor the user's node to the outer halo edge (one-time pull)
    if (isActive && connectedNodeId && !wasActive) {
      const connectedNode = elementsRef.current.agents.find((a) => a.id === connectedNodeId);
      const selfAgent = elementsRef.current.agents.find((a) => a.id === elementsRef.current.selfId);
      if (connectedNode) {
        // Place anchor at the outer halo edge, not the node center
        const outerHaloRadius = OUTER_HALO_RADIUS;
        let anchorX = connectedNode.x;
        let anchorY = connectedNode.y;

        if (selfAgent) {
          const dx = selfAgent.x - connectedNode.x;
          const dy = selfAgent.y - connectedNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            // Offset along the direction from node center toward self-agent
            anchorX = connectedNode.x + (dx / dist) * outerHaloRadius;
            anchorY = connectedNode.y + (dy / dist) * outerHaloRadius;
          }
        }

        elementsRef.current.mouse.isAnchored = true;
        elementsRef.current.mouse.anchorX = anchorX;
        elementsRef.current.mouse.anchorY = anchorY;
      }
    }

    // Disconnect transition: un-anchor to return to free state
    if (!isActive && wasActive) {
      elementsRef.current.mouse.isAnchored = false;
    }

    prevIsActiveRef.current = isActive;
  }, [isActive, isListener, dataTransferRate, connectedNodeId, isReady]);

  const handleMouseMove = (x: number, y: number) => {
    elementsRef.current.mouse.x = x;
    elementsRef.current.mouse.y = y;
    elementsRef.current.mouse.isInteracting = true;

    // Auto-release interaction after a brief delay if mouse stops
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      elementsRef.current.mouse.isInteracting = false;
    }, 1500);
  };

  const handleClick = () => {
    const mouse = elementsRef.current.mouse;
    const hoveredNodeId = spatialDataRef.current?.hoveredNodeId;

    // Node halo clicks are handled entirely by the React layer (page.tsx).
    // The physics engine only processes empty-space anchor clicks.
    if (hoveredNodeId) return;

    // Empty space click: toggle positional anchor
    mouse.isAnchored = !mouse.isAnchored;
    mouse.anchorX = mouse.worldX;
    mouse.anchorY = mouse.worldY;
  };

  const updatePeers = (peerMap: PeerMapEntry[], socketId?: string | null) => {
    // Save these for tick() access
    elementsRef.current.lastSocketId = socketId || null;
    elementsRef.current.lastPeerMap = peerMap;

    // Sync the internal simulation with the global tracker
    // Remove entities that are no longer in the map (or are us)
    const myIds = new Set([elementsRef.current.selfId]);
    if (socketId) myIds.add(socketId);

    const activeIds = new Set(peerMap.map((p) => p.id));
    for (const id of myIds) {
      activeIds.add(id);
    }

    elementsRef.current.agents = elementsRef.current.agents.filter(
      (a) => activeIds.has(a.id) || a.id.startsWith("root"),
    );

    // Add or Update from the Tracker Map
    for (const peer of peerMap) {
      if (myIds.has(peer.id)) continue;
      if (!peer.latentState) continue;

      const existing = elementsRef.current.agents.find((a) => a.id === peer.id);
      if (existing) {
        // If it exists, lerp towards the server's truth quietly, or just snap
        existing.x += (peer.latentState.x - existing.x) * 0.1;
        existing.y += (peer.latentState.y - existing.y) * 0.1;
        existing.spin += (peer.latentState.spin - existing.spin) * 0.1;

        // Sync Energy from Tracker
        if (peer.energy !== undefined) {
          existing.energy += (peer.energy - existing.energy) * 0.1;
        }
      } else {
        // Determine if it's the root node or a listener relay
        const isRoot = peer.role === "root";
        elementsRef.current.agents.push({
          id: peer.id,
          type: isRoot ? "node" : "listener",
          x: peer.latentState.x,
          y: peer.latentState.y,
          vx: 0,
          vy: 0,
          spin: peer.latentState.spin,
          spinVelocity: 0,
          mass: isRoot ? 100 : 1,
          energy: peer.energy !== undefined ? peer.energy : (isRoot ? 100 : 0),
          pulsePhase: Math.random() * Math.PI,
        });
      }
    }
  };

  const tick = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const state = stateRef.current;
    const els = elementsRef.current;
    const currentIsActive = state.isActive;
    const currentIsListener = state.isListener;

    timeRef.current += 0.016;
    const time = timeRef.current;

    // Ensure self agent exists
    let selfAgent = els.agents.find((a) => a.id === els.selfId);
    if (!selfAgent) {
      // Cold Start Physics: Spawn with a slight bias (e.g., center + noise)
      selfAgent = {
        id: els.selfId,
        type: "listener",
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2 + (Math.random() - 0.5) * 100,
        vx: 0,
        vy: 0,
        spin: Math.random(),
        spinVelocity: 0,
        mass: 1,
        energy: 0,
        pulsePhase: 0,
      };
      els.agents.push(selfAgent);
    }

    // Manage Master Broadcast Node dynamically based on state
    // NOTE: If we are a Listener, we now rely on `updatePeers` to spawn the root node.
    // If we are the Broadcaster, we still auto-spawn ourselves in the center.
    const existingNodeIndex = els.agents.findIndex((a) => a.type === "node");
    if (currentIsActive && existingNodeIndex === -1 && !currentIsListener) {
      els.agents.push({
        id: "root-broadcast",
        type: "node",
        x: width / 2,
        y: height / 2,
        vx: 0,
        vy: 0,
        spin: 0.5,
        spinVelocity: 0,
        mass: 100,
        energy: 100, // E_0 start
        pulsePhase: 0,
      });
    } else if (
      currentIsActive && existingNodeIndex !== -1 && !currentIsListener
    ) {
      // Sync broadcaster's own energy from tracker if available
      const existingNode = els.agents[existingNodeIndex];
      const trackerData = els.lastPeerMap.find((p: PeerMapEntry) => p.id === els.lastSocketId);
      if (trackerData && trackerData.energy !== undefined) {
        existingNode.energy += (trackerData.energy - existingNode.energy) * 0.1;
      }
    } else if (
      !currentIsActive &&
      existingNodeIndex !== -1 &&
      !currentIsListener
    ) {
      els.agents.splice(existingNodeIndex, 1);
    }

    // Smoothly interpolate transition state (fade in/out)
    if (currentIsActive && transitionScalarRef.current < 1) {
      transitionScalarRef.current += 0.02;
      if (transitionScalarRef.current > 1) transitionScalarRef.current = 1;
    } else if (!currentIsActive && transitionScalarRef.current > 0) {
      transitionScalarRef.current -= 0.02;
      if (transitionScalarRef.current < 0) transitionScalarRef.current = 0;
    }

    const transitionScalar = transitionScalarRef.current;

    // Zoom interpolation
    if (state.isReady && zoomScalarRef.current < 1) {
      zoomScalarRef.current += 0.01;
      if (zoomScalarRef.current > 1) zoomScalarRef.current = 1;
    } else if (!state.isReady && zoomScalarRef.current > 0.1) {
      zoomScalarRef.current -= 0.02; // Zooms out faster
      if (zoomScalarRef.current < 0.1) zoomScalarRef.current = 0.1;
    }
    const zoomScalar = zoomScalarRef.current;

    // Convert screen mouse to world coordinates
    els.mouse.worldX = (els.mouse.x - width / 2) / zoomScalar + width / 2;
    els.mouse.worldY = (els.mouse.y - height / 2) / zoomScalar + height / 2;

    // Clear frame with trail effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    applyForcesAndKinematics(
      els.agents,
      els.selfId,
      els.mouse,
      currentIsActive,
      currentIsListener,
      state.dataTransferRate,
      width,
      height
    );

    // --- RENDERING PHASE ---

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoomScalar, zoomScalar);
    ctx.translate(-width / 2, -height / 2);

    let frameHoveredNodeId: string | null = null;
    const mouseX = els.mouse.worldX;
    const mouseY = els.mouse.worldY;

    // Render Edges (Network connections & Spin-Wave visibility)
    ctx.lineWidth = 0.5;
    for (let i = 0; i < els.agents.length; i++) {
      const a = els.agents[i];

      // Draw Node Halos & Pulse
      if (a.type === "node") {
        const nodePulseScalar =
          a.id === "root-broadcast" && !currentIsListener
            ? transitionScalar * (a.energy / 100) // Extinguish if energy is low
            : 1.0 * Math.max(0.1, a.energy / 100);

        // Amplify the pulse visibly during high fidelity audio transfer
        const fidelityMultiplier = state.activeProfile === "HIGH_FIDELITY" ? 2.5 : 1.0;
        a.pulsePhase += (0.05 * state.dataTransferRate) * fidelityMultiplier;
        const pulse = ((Math.sin(a.pulsePhase) * 2 + 6) * nodePulseScalar) * (state.activeProfile === "HIGH_FIDELITY" ? 1.5 : 1.0);
        const outerRadius = (OUTER_HALO_RADIUS + pulse * 1.5) * nodePulseScalar;

        // Hover detection
        const dx = a.x - mouseX;
        const dy = a.y - mouseY;
        const distMouse = Math.sqrt(dx * dx + dy * dy);
        const isHovered = distMouse < outerRadius;
        if (isHovered) {
          frameHoveredNodeId = a.id;
        }

        const isConnected = currentIsActive && a.id === connectedNodeId;

        // Color logic
        let strokeColor = `rgba(255, 255, 255, ${(0.1 + Math.sin(a.pulsePhase) * 0.05) * nodePulseScalar})`;
        if (isHovered) {
          if (isConnected) {
            strokeColor = `rgba(255, 50, 50, 0.8)`; // Subtly highlighted in red if hovered and connected to disconnect
          } else {
            strokeColor = `rgba(255, 255, 255, 0.7)`; // Subtly highlighted when just hovered to connect
          }
        } else if (isConnected) {
          strokeColor = `rgba(150, 200, 255, 0.4)`; // Subtle blue/cyan tint when actively connected but not hovered
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${nodePulseScalar})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 4 * nodePulseScalar, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(a.x, a.y, (30 + pulse) * nodePulseScalar, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(a.x, a.y, outerRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Lines to close neighbors (Spin-Wave interaction)
      for (let j = i + 1; j < els.agents.length; j++) {
        const b = els.agents[j];
        const dist = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

        if (dist < INTERACTION_RADIUS) {
          const isNodeLink = a.type === "node" || b.type === "node";
          const isSelfLink = a.id === els.selfId || b.id === els.selfId;

          if (isNodeLink) {
            ctx.strokeStyle = `rgba(150, 150, 150, ${((INTERACTION_RADIUS - dist) / INTERACTION_RADIUS) * 0.3})`;
          } else if (isSelfLink) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${((INTERACTION_RADIUS - dist) / INTERACTION_RADIUS) * 0.2})`;
          } else {
            // Ambient particle connections based on spin alignment
            const spinDiff = Math.abs(a.spin - b.spin);
            const alignment =
              1 - (spinDiff > 0.5 ? 1 - spinDiff : spinDiff) * 2; // 0 to 1
            ctx.strokeStyle = `hsla(${a.spin * 360}, 50%, 50%, ${Math.max(0, alignment * 0.15)})`;
          }

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Draw Particles
      if (a.type === "listener") {
        const isSelf = a.id === els.selfId;
        const hue = Math.floor(a.spin * 360);

        if (isSelf) {
          ctx.fillStyle = `rgba(255, 255, 255, 1)`;
          ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.8)`;
        } else {
          ctx.fillStyle = `hsla(${hue}, 60%, 60%, 0.8)`;
        }

        ctx.beginPath();
        ctx.arc(a.x, a.y, isSelf ? 3 : 1.5, 0, Math.PI * 2);
        ctx.fill();

        if (isSelf && currentIsListener) {
          ctx.beginPath();
          ctx.arc(
            a.x,
            a.y,
            8 + Math.sin(time * 5 * state.dataTransferRate) * 2,
            0,
            Math.PI * 2,
          );
          ctx.stroke();

          // Draw connection bond line to broadcast node (prop-driven)
          if (currentIsActive && state.connectedNodeId) {
            const connectedNode = els.agents.find(
              (n) => n.id === state.connectedNodeId,
            );
            if (connectedNode) {
              ctx.strokeStyle = "rgba(255,255,255, 0.4)";
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(connectedNode.x, connectedNode.y);
              ctx.stroke();
            }
          } else if (els.mouse.isAnchored) {
            // Draw empty-space anchor line (user placed anchor in open field)
            ctx.strokeStyle = "rgba(255,255,255, 0.4)";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(els.mouse.anchorX, els.mouse.anchorY);
            ctx.stroke();

            ctx.fillStyle = "rgba(255,255,255, 0.2)";
            ctx.beginPath();
            ctx.arc(els.mouse.anchorX, els.mouse.anchorY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    ctx.restore();

    // Emit Spatial Data to React Ref for Audio Integration
    if (selfAgent) {
      const node =
        els.agents.find((a) => a.id === connectedNodeId) ||
        els.agents.find((a) => a.type === "node");
      if (node) {
        const dx = node.x - selfAgent.x;
        const dy = node.y - selfAgent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        spatialDataRef.current = {
          distanceToNode: dist,
          pan: dx / width, // Approx -1 to 1 based on screen width
          isActive: currentIsActive,
          latent: { x: selfAgent.x, y: selfAgent.y, spin: selfAgent.spin },
          hoveredNodeId: frameHoveredNodeId,
        };
      } else {
        spatialDataRef.current = {
          distanceToNode: Infinity,
          pan: 0,
          isActive: false,
          latent: { x: selfAgent.x, y: selfAgent.y, spin: selfAgent.spin },
          hoveredNodeId: frameHoveredNodeId,
        };
      }
    }
  };

  return { tick, handleMouseMove, handleClick, updatePeers };
}
