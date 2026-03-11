import type { NodeSemanticSnapshot } from "@/lib/a11y/contracts";
import type { PeerMapEntry } from "@/lib/types";

export function buildNodeSemanticSnapshots(
  peers: PeerMapEntry[],
  tunedNodeId: string | null,
): NodeSemanticSnapshot[] {
  return peers
    .filter((peer) => peer.role === "root" || peer.role === "relay")
    .map((peer) => ({
      id: peer.id,
      label: peer.activeCuratorialGraph?.name ?? peer.id.slice(0, 4),
      listeners: peer.connections,
      energy: Math.round(peer.energy ?? 0),
      x: peer.latentState?.x ?? 0,
      y: peer.latentState?.y ?? 0,
      isTuned: tunedNodeId === peer.id,
    }));
}
