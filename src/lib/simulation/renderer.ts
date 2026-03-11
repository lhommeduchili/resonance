import { INTERACTION_RADIUS, OUTER_HALO_RADIUS } from "@/lib/physicsConstants";
import type { SimulationFrameState } from "@/lib/simulation/contracts";

export function renderSimulationFrame(
  ctx: CanvasRenderingContext2D,
  frame: SimulationFrameState,
): string | null {
  const { agents, selfId, mouse, width, height, time, zoomScalar, transitionScalar, config } = frame;

  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(zoomScalar, zoomScalar);
  ctx.translate(-width / 2, -height / 2);

  let frameHoveredNodeId: string | null = null;
  const mouseX = mouse.worldX;
  const mouseY = mouse.worldY;

  ctx.lineWidth = 0.5;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];

    if (a.type === "node") {
      const nodePulseScalar =
        a.id === "root-broadcast" && !config.isListener
          ? transitionScalar * (a.energy / 100)
          : 1.0 * Math.max(0.1, a.energy / 100);

      const fidelityMultiplier = config.activeProfile === "HIGH_FIDELITY" ? 2.5 : 1.0;
      a.pulsePhase += (0.05 * config.dataTransferRate) * fidelityMultiplier;
      const pulse =
        ((Math.sin(a.pulsePhase) * 2 + 6) * nodePulseScalar) *
        (config.activeProfile === "HIGH_FIDELITY" ? 1.5 : 1.0);
      const outerRadius = (OUTER_HALO_RADIUS + pulse * 1.5) * nodePulseScalar;

      const dx = a.x - mouseX;
      const dy = a.y - mouseY;
      const distMouse = Math.sqrt(dx * dx + dy * dy);
      const isHovered = distMouse < outerRadius;
      if (isHovered) {
        frameHoveredNodeId = a.id;
      }

      const isConnected = config.isActive && a.id === config.connectedNodeId;

      let strokeColor = `rgba(255, 255, 255, ${(0.1 + Math.sin(a.pulsePhase) * 0.05) * nodePulseScalar})`;
      if (isHovered) {
        strokeColor = isConnected ? "rgba(255, 50, 50, 0.8)" : "rgba(255, 255, 255, 0.7)";
      } else if (isConnected) {
        strokeColor = "rgba(150, 200, 255, 0.4)";
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

    for (let j = i + 1; j < agents.length; j++) {
      const b = agents[j];
      const dist = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

      if (dist < INTERACTION_RADIUS) {
        const isNodeLink = a.type === "node" || b.type === "node";
        const isSelfLink = a.id === selfId || b.id === selfId;

        if (isNodeLink) {
          ctx.strokeStyle = `rgba(150, 150, 150, ${((INTERACTION_RADIUS - dist) / INTERACTION_RADIUS) * 0.3})`;
        } else if (isSelfLink) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${((INTERACTION_RADIUS - dist) / INTERACTION_RADIUS) * 0.2})`;
        } else {
          const spinDiff = Math.abs(a.spin - b.spin);
          const alignment = 1 - (spinDiff > 0.5 ? 1 - spinDiff : spinDiff) * 2;
          ctx.strokeStyle = `hsla(${a.spin * 360}, 50%, 50%, ${Math.max(0, alignment * 0.15)})`;
        }

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    if (a.type === "listener") {
      const isSelf = a.id === selfId;
      const hue = Math.floor(a.spin * 360);

      if (isSelf) {
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.8)`;
      } else {
        ctx.fillStyle = `hsla(${hue}, 60%, 60%, 0.8)`;
      }

      ctx.beginPath();
      ctx.arc(a.x, a.y, isSelf ? 3 : 1.5, 0, Math.PI * 2);
      ctx.fill();

      if (isSelf && config.isListener) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, 8 + Math.sin(time * 5 * config.dataTransferRate) * 2, 0, Math.PI * 2);
        ctx.stroke();

        if (config.isActive && config.connectedNodeId) {
          const connectedNode = agents.find((n) => n.id === config.connectedNodeId);
          if (connectedNode) {
            ctx.strokeStyle = "rgba(255,255,255, 0.4)";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(connectedNode.x, connectedNode.y);
            ctx.stroke();
          }
        } else if (mouse.isAnchored) {
          ctx.strokeStyle = "rgba(255,255,255, 0.4)";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.anchorX, mouse.anchorY);
          ctx.stroke();

          ctx.fillStyle = "rgba(255,255,255, 0.2)";
          ctx.beginPath();
          ctx.arc(mouse.anchorX, mouse.anchorY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  ctx.restore();
  return frameHoveredNodeId;
}
