import type { Agent } from "@/lib/simulation/contracts";
import type { PeerMapEntry } from "@/lib/types";

type ReconcileParams = {
  agents: Agent[];
  peerMap: PeerMapEntry[];
  selfId: string;
  socketId?: string | null;
  random: () => number;
};

export function reconcilePeerAgents({
  agents,
  peerMap,
  selfId,
  socketId,
  random,
}: ReconcileParams): Agent[] {
  const myIds = new Set([selfId]);
  if (socketId) {
    myIds.add(socketId);
  }

  const activeIds = new Set(peerMap.map((peer) => peer.id));
  myIds.forEach((id) => activeIds.add(id));

  const nextAgents = agents.filter((agent) => activeIds.has(agent.id) || agent.id.startsWith("root"));

  for (const peer of peerMap) {
    if (myIds.has(peer.id)) {
      continue;
    }
    if (!peer.latentState) {
      continue;
    }

    const existing = nextAgents.find((agent) => agent.id === peer.id);
    if (existing) {
      existing.x += (peer.latentState.x - existing.x) * 0.1;
      existing.y += (peer.latentState.y - existing.y) * 0.1;
      existing.spin += (peer.latentState.spin - existing.spin) * 0.1;

      if (peer.energy !== undefined) {
        existing.energy += (peer.energy - existing.energy) * 0.1;
      }
      continue;
    }

    const isRoot = peer.role === "root";
    nextAgents.push({
      id: peer.id,
      type: isRoot ? "node" : "listener",
      x: peer.latentState.x,
      y: peer.latentState.y,
      vx: 0,
      vy: 0,
      spin: peer.latentState.spin,
      spinVelocity: 0,
      mass: isRoot ? 100 : 1,
      energy: peer.energy !== undefined ? peer.energy : isRoot ? 100 : 0,
      pulsePhase: random() * Math.PI,
    });
  }

  return nextAgents;
}
