"use client";

import type { AppMessages } from "@/lib/i18n/dictionaries";
import type { NodeSemanticSnapshot } from "@/lib/a11y/contracts";
import { clampOverlayPoint, projectWorldToScreen } from "@/lib/a11y/positioning";

export function SpatialOverlay({
  nodes,
  messages,
  onFocusNode,
  onTuneNode,
  onUntuneNode,
  viewport,
}: {
  nodes: NodeSemanticSnapshot[];
  messages: AppMessages;
  onFocusNode: (nodeId: string) => void;
  onTuneNode: (nodeId: string) => void;
  onUntuneNode: () => void;
  viewport: { width: number; height: number; zoomScalar: number };
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      aria-live="polite"
      aria-label={messages.a11y.overlayRegionLabel}
    >
      {nodes.map((node) => {
        const viewportWidth = viewport.width || 1920;
        const viewportHeight = viewport.height || 1080;
        const zoomScalar = viewport.zoomScalar || 1;

        const actionLabel = node.isTuned ? messages.home.disconnectFromNode : messages.home.tuneIntoNode;
        const info = messages.a11y.nodeStatus
          .replace("{listeners}", String(node.listeners))
          .replace("{energy}", String(node.energy));

        const projected = projectWorldToScreen(
          node.x,
          node.y,
          viewportWidth,
          viewportHeight,
          zoomScalar,
        );
        const point = clampOverlayPoint(
          projected.x,
          projected.y,
          viewportWidth,
          viewportHeight,
        );

        return (
          <button
            key={node.id}
            className="pointer-events-auto absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent bg-transparent opacity-0 focus:opacity-100 focus:outline-none focus-visible:border-foreground/70"
            style={{ left: `${point.x}px`, top: `${point.y}px` }}
            onFocus={() => onFocusNode(node.id)}
            onClick={(event) => {
              event.stopPropagation();
              if (node.isTuned) {
                onUntuneNode();
                return;
              }
              onTuneNode(node.id);
            }}
            aria-pressed={node.isTuned}
            aria-label={`${actionLabel} ${messages.home.broadcastNode} ${node.label}. ${info}`}
          >
            <span className="sr-only">{`${actionLabel} ${messages.home.broadcastNode} ${node.label}`}</span>
          </button>
        );
      })}
    </div>
  );
}
