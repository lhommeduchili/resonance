import { Socket } from "socket.io";

export interface PeerData {
    socket: Socket;
    id?: string;
    role: "observer" | "relay" | "root";
    connections: number;
    maxCapacity: number;
    energy: number;
    lastEnergyUpdate: number;
    latentState: { x: number; y: number; spin: number };
    activeCuratorialGraphId: string | null;
    currentSessionDbId: string | null;
    currentUpstreamId?: string | null;
}

/**
 * Executes thermodynamic decay / energy synthesis on the global peer map.
 * Returns true if energy changed and map should be broadcasted.
 */
export function calculateEnergyDecay(peers: Map<string, PeerData>, now: number): boolean {
    let changed = false;
    for (const [id, data] of peers.entries()) {
        if (data.role === "root" || data.role === "relay") {
            const dt = (now - data.lastEnergyUpdate) / 1000;
            if (dt >= 1.0) {
                let newEnergy = data.energy * Math.exp(-0.03 * dt); // Exponential decay Lambda = 0.03

                // Support Synthesis
                const supportSynthesis = data.connections * 2.0 * dt;
                newEnergy += supportSynthesis;

                // Clamp Energy
                data.energy = Math.max(5, Math.min(200, newEnergy));
                data.lastEnergyUpdate = now;
                changed = true;
            }
        }
    }
    return changed;
}

/**
 * Evaluates the global map to find the best peer target for adaptive mesh routing.
 */
export function findOptimalPeer(
    requesterId: string,
    requesterState: { x: number; y: number; spin: number },
    peers: Map<string, PeerData>,
    rootBroadcasterId: string | null
): { id: string; role: string; score: number } | null {
    if (!rootBroadcasterId || !peers.has(rootBroadcasterId)) return null;

    let bestCandidate = null;
    let highestScore = -Infinity;

    for (const [id, peerData] of peers.entries()) {
        if (id === requesterId) continue;
        if (peerData.role === "observer") continue;
        if (peerData.connections >= peerData.maxCapacity) continue;

        // 1. Stability Score
        const rootLoad = peerData.connections / peerData.maxCapacity;
        const stabilityScore = peerData.role === "root" ? (1 - rootLoad) * 30 : 0;

        // 2. Bandwidth Score
        const capacityRatio = peerData.connections / peerData.maxCapacity;
        const bandwidthScore = (1 - capacityRatio) * 30;

        // 3. Latent Adjacency Score
        const dx = peerData.latentState.x - requesterState.x;
        const dy = peerData.latentState.y - requesterState.y;
        const dSpin = Math.abs(peerData.latentState.spin - requesterState.spin);

        const spatialDist = Math.sqrt(dx * dx + dy * dy);
        let adjacencyScore = 0;
        if (spatialDist < 500) {
            const normalizedSpatialDist = 1 - (spatialDist / 500);
            const normalizedSpinDist = Math.max(0, 1 - (dSpin > 0.5 ? 1 - dSpin : dSpin) * 4);
            adjacencyScore = (normalizedSpatialDist * 80) + (normalizedSpinDist * 20);
        }

        const totalScore = stabilityScore + bandwidthScore + adjacencyScore;

        if (totalScore > highestScore) {
            highestScore = totalScore;
            bestCandidate = { id, role: peerData.role, score: totalScore };
        }
    }

    return bestCandidate;
}

/**
 * Evaluates hysteresis checking if a reconnect suggestion is worthwhile.
 */
export function checkReRouteCondition(
    bestCandidate: { id: string; score: number } | null,
    currentUpstreamId: string | null | undefined,
    requesterState: { x: number; y: number; spin: number },
    peers: Map<string, PeerData>
): boolean {
    if (!bestCandidate) return false;
    if (bestCandidate.id === currentUpstreamId) return false;

    let currentParentScore = -Infinity;
    if (currentUpstreamId) {
        const currentParentData = peers.get(currentUpstreamId);
        if (currentParentData) {
            const rootLoad = currentParentData.connections / currentParentData.maxCapacity;
            const sScore = currentParentData.role === "root" ? (1 - rootLoad) * 30 : 0;
            const cRatio = currentParentData.connections / currentParentData.maxCapacity;
            const bScore = (1 - cRatio) * 30;

            const dx = currentParentData.latentState.x - requesterState.x;
            const dy = currentParentData.latentState.y - requesterState.y;
            const dSpin = Math.abs(currentParentData.latentState.spin - requesterState.spin);
            const dist = Math.sqrt(dx * dx + dy * dy);

            let aScore = 0;
            if (dist < 500) {
                const nDist = 1 - (dist / 500);
                const nSpin = Math.max(0, 1 - (dSpin > 0.5 ? 1 - dSpin : dSpin) * 4);
                aScore = (nDist * 80) + (nSpin * 20);
            }
            currentParentScore = sScore + bScore + aScore;
        }
    }

    return bestCandidate.score > currentParentScore + 20;
}
