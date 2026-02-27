"use client";

import { useEffect, useRef } from "react";
import {
  GRAVITY_MULTIPLIER,
  ANTI_MONOPOLY_REPULSION,
  SPIN_WAVE_SPEED,
  SPIN_INERTIA,
  SPATIAL_FRICTION,
  INTERACTION_RADIUS,
  OUTER_HALO_RADIUS,
  ANCHOR_SPRING,
  FREE_SPRING,
} from "@/lib/physicsConstants";

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
) {
  const stateRef = useRef({
    isActive,
    isListener,
    dataTransferRate,
    connectedNodeId,
  });
  const elementsRef = useRef({
    agents: [] as Agent[],
    selfId: "self",
    mouse: {
      x: 0,
      y: 0,
      isAnchored: false,
      anchorX: 0,
      anchorY: 0,
      isInteracting: false,
    },
  });
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Internal timing state
  const timeRef = useRef(0);
  const transitionScalarRef = useRef(0);
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
  }, [isActive, isListener, dataTransferRate, connectedNodeId]);

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
    mouse.anchorX = mouse.x;
    mouse.anchorY = mouse.y;
  };

  const updatePeers = (peerMap: any[], socketId?: string | null) => {
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
          energy: isRoot ? 100 : 0,
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
        energy: 100, // E_base
        pulsePhase: 0,
      });
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

    // Clear frame with trail effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, width, height);

    // Populate ambient particles (Noise/Exploration) (Disabled for debugging real peers)
    /*
        if (els.agents.length < 50 && Math.random() < 0.2) {
            els.agents.push({
                id: `ambient-${Math.random()}`,
                type: "listener",
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                spin: Math.random(),
                spinVelocity: 0,
                mass: 0.5,
                energy: 0,
                pulsePhase: Math.random() * Math.PI,
                life: 0
            });
        }
        */

    // Physics constants
    const G = GRAVITY_MULTIPLIER;
    const C_repulse = ANTI_MONOPOLY_REPULSION;
    const C_spin_wave = SPIN_WAVE_SPEED;
    const Spin_inertia = SPIN_INERTIA;
    const Friction = SPATIAL_FRICTION;
    const InteractionRadius = INTERACTION_RADIUS;

    // Apply Forces
    for (let i = 0; i < els.agents.length; i++) {
      const agent = els.agents[i];
      if (agent.type === "node") continue; // Nodes are stationary sources in MVP

      let F_x = 0;
      let F_y = 0;
      let spinLaplacian = 0; // Neighbors' average spin state diff
      let neighborCount = 0;

      // F_user: Overriding Force
      // Free state: gentle spring toward mouse position (node follows cursor)
      // Anchored state: stronger spring toward anchor point (set by empty-space click or broadcast connection)
      const isSelf = agent.id === els.selfId;
      const mouse = els.mouse;
      if (isSelf && mouse.isInteracting && currentIsListener) {
        const targetX = mouse.isAnchored ? mouse.anchorX : mouse.x;
        const targetY = mouse.isAnchored ? mouse.anchorY : mouse.y;
        const dx = targetX - agent.x;
        const dy = targetY - agent.y;
        const spring = mouse.isAnchored ? ANCHOR_SPRING : FREE_SPRING;
        F_x += dx * spring;
        F_y += dy * spring;
      }

      // Interactions with other agents
      for (let j = 0; j < els.agents.length; j++) {
        if (i === j) continue;
        const other = els.agents[j];
        const dx = other.x - agent.x;
        const dy = other.y - agent.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < 1) continue; // Prevent divisions by zero

        if (other.type === "node") {
          // Attraction (F_attract) - Gravity towards active broadcast
          // Self-agent only feels gravity when explicitly tuned in (isActive).
          // This prevents the user from drifting toward a node after disconnecting.
          const applyGravity = !isSelf || currentIsActive;
          const force = applyGravity
            ? (G * other.energy * agent.mass) / distSq
            : 0;
          F_x += (dx / dist) * force;
          F_y += (dy / dist) * force; // Added missing F_y for gravity

          // Repulsion (Anti-Monopoly Core)
          if (dist < 50) {
            const repulseF = C_repulse / distSq;
            F_x -= (dx / dist) * repulseF;
            F_y -= (dy / dist) * repulseF;
          }
        } else if (other.type === "listener" && dist < InteractionRadius) {
          // Spin-Wave Alignment (Information Exchange)
          spinLaplacian += other.spin - agent.spin;
          neighborCount++;

          // Soft Repulsion (Density spread among peers)
          if (dist < 20) {
            const repulseF = 10 / distSq;
            F_x -= (dx / dist) * repulseF;
            F_y -= (dy / dist) * repulseF;
          }
        }
      }

      // Noise (F_noise) - Barely noticeable for very subtle organic shifting
      if (agent.type === "listener") {
        F_x += (Math.random() - 0.5) * 0.05;
        F_y += (Math.random() - 0.5) * 0.05;
      }

      // Spin-Wave Kinematics (Attanasi et al.)
      if (neighborCount > 0) {
        const avgLaplacian = spinLaplacian / neighborCount;
        agent.spinVelocity += avgLaplacian * C_spin_wave;
      }
      agent.spinVelocity *= Spin_inertia;
      agent.spin += agent.spinVelocity;

      // Keep spin wrapped between [0, 1] mapped to [0, 360] hues
      if (agent.spin > 1) agent.spin -= 1;
      if (agent.spin < 0) agent.spin += 1;

      // Apply Net Force (F_total) to position
      if (!isSelf || (!mouse.isInteracting && currentIsListener)) {
        // If the user is idle, emergent forces take over their avatar
        agent.vx += F_x / agent.mass;
        agent.vy += F_y / agent.mass;
      } else if (isSelf && mouse.isInteracting) {
        // User is forcing movement, add slight jitter scaled by transfer rate
        agent.vx +=
          F_x + (Math.random() - 0.5) * (state.dataTransferRate * 0.5);
        agent.vy +=
          F_y + (Math.random() - 0.5) * (state.dataTransferRate * 0.5);
      }

      agent.vx *= Friction;
      agent.vy *= Friction;

      agent.x += agent.vx;
      agent.y += agent.vy;

      // Age ambient particles
      if (agent.life !== undefined) {
        agent.life += 0.01;
        // De-spawn logic
        if (
          agent.life > 10 ||
          agent.x < 0 ||
          agent.x > width ||
          agent.y < 0 ||
          agent.y > height
        ) {
          els.agents.splice(i, 1);
          i--;
        }
      }
    }

    // --- RENDERING PHASE ---

    let frameHoveredNodeId: string | null = null;
    const mouseX = els.mouse.x;
    const mouseY = els.mouse.y;

    // Render Edges (Network connections & Spin-Wave visibility)
    ctx.lineWidth = 0.5;
    for (let i = 0; i < els.agents.length; i++) {
      const a = els.agents[i];

      // Draw Node Halos & Pulse
      if (a.type === "node") {
        const nodePulseScalar =
          a.id === "root-broadcast" && !currentIsListener
            ? transitionScalar
            : 1.0;

        a.pulsePhase += 0.05 * state.dataTransferRate;
        const pulse = (Math.sin(a.pulsePhase) * 2 + 6) * nodePulseScalar;
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

        if (dist < InteractionRadius) {
          const isNodeLink = a.type === "node" || b.type === "node";
          const isSelfLink = a.id === els.selfId || b.id === els.selfId;

          if (isNodeLink) {
            ctx.strokeStyle = `rgba(150, 150, 150, ${((InteractionRadius - dist) / InteractionRadius) * 0.3})`;
          } else if (isSelfLink) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${((InteractionRadius - dist) / InteractionRadius) * 0.2})`;
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
