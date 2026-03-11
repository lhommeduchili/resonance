import {
    GRAVITY_MULTIPLIER,
    ANTI_MONOPOLY_REPULSION,
    SPIN_WAVE_SPEED,
    SPIN_INERTIA,
    SPATIAL_FRICTION,
    INTERACTION_RADIUS,
    ANCHOR_SPRING,
    FREE_SPRING,
} from "@/lib/physicsConstants";
import type { Agent } from "@/lib/simulation/contracts";

export function computeInteractionForce(
    agent: Agent,
    other: Agent,
    isSelf: boolean,
    currentIsActive: boolean
): { F_x: number; F_y: number; spinLaplacian: number; neighborCount: number } {
    let F_x = 0;
    let F_y = 0;
    let spinLaplacian = 0;
    let neighborCount = 0;

    const dx = other.x - agent.x;
    const dy = other.y - agent.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 1) return { F_x, F_y, spinLaplacian, neighborCount };

    if (other.type === "node") {
        // Attraction
        const applyGravity = !isSelf || currentIsActive;
        const force = applyGravity ? (GRAVITY_MULTIPLIER * other.energy * agent.mass) / distSq : 0;
        F_x += (dx / dist) * force;
        F_y += (dy / dist) * force;

        // Repulsion (Anti-Monopoly Core)
        if (dist < 50) {
            const repulseF = ANTI_MONOPOLY_REPULSION / distSq;
            F_x -= (dx / dist) * repulseF;
            F_y -= (dy / dist) * repulseF;
        }
    } else if (other.type === "listener" && dist < INTERACTION_RADIUS) {
        // Spin-Wave Alignment
        spinLaplacian += other.spin - agent.spin;
        neighborCount++;

        // Soft Repulsion
        if (dist < 20) {
            const repulseF = 10 / distSq;
            F_x -= (dx / dist) * repulseF;
            F_y -= (dy / dist) * repulseF;
        }
    }

    return { F_x, F_y, spinLaplacian, neighborCount };
}

export function computeUserForce(
    agent: Agent,
    mouse: { worldX: number; worldY: number; isAnchored: boolean; anchorX: number; anchorY: number }
): { F_x: number; F_y: number } {
    const targetX = mouse.isAnchored ? mouse.anchorX : mouse.worldX;
    const targetY = mouse.isAnchored ? mouse.anchorY : mouse.worldY;
    const dx = targetX - agent.x;
    const dy = targetY - agent.y;
    const spring = mouse.isAnchored ? ANCHOR_SPRING : FREE_SPRING;
    return { F_x: dx * spring, F_y: dy * spring };
}

export function applyForcesAndKinematics(
    agents: Agent[],
    selfId: string,
    mouse: { worldX: number; worldY: number; isInteracting: boolean; isAnchored: boolean; anchorX: number; anchorY: number },
    currentIsActive: boolean,
    currentIsListener: boolean,
    dataTransferRate: number,
    width: number,
    height: number,
    deltaSeconds: number,
    random: () => number
) {
    const referenceStepScale = deltaSeconds * 60;
    const clampedReferenceScale = Math.max(0, Math.min(3, referenceStepScale));

    for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        if (agent.type === "node") continue;

        let F_x = 0;
        let F_y = 0;
        let totalSpinLaplacian = 0;
        let totalNeighborCount = 0;

        const isSelf = agent.id === selfId;
        if (isSelf && mouse.isInteracting && currentIsListener) {
            const { F_x: uf_x, F_y: uf_y } = computeUserForce(agent, mouse);
            F_x += uf_x;
            F_y += uf_y;
        }

        // Interactions
        for (let j = 0; j < agents.length; j++) {
            if (i === j) continue;
            const res = computeInteractionForce(agent, agents[j], isSelf, currentIsActive);
            F_x += res.F_x;
            F_y += res.F_y;
            totalSpinLaplacian += res.spinLaplacian;
            totalNeighborCount += res.neighborCount;
        }

        // Noise
        if (agent.type === "listener") {
            const noiseScale = Math.sqrt(clampedReferenceScale);
            F_x += (random() - 0.5) * 0.05 * noiseScale;
            F_y += (random() - 0.5) * 0.05 * noiseScale;
        }

        // Spin-Wave Kinematics
        if (totalNeighborCount > 0) {
            const avgLaplacian = totalSpinLaplacian / totalNeighborCount;
            agent.spinVelocity += avgLaplacian * SPIN_WAVE_SPEED * clampedReferenceScale;
        }
        agent.spinVelocity *= Math.pow(SPIN_INERTIA, clampedReferenceScale);
        agent.spin += agent.spinVelocity * clampedReferenceScale;

        if (agent.spin > 1) agent.spin -= 1;
        if (agent.spin < 0) agent.spin += 1;

        // Apply Net Force
        if (!isSelf || (!mouse.isInteracting && currentIsListener)) {
            agent.vx += (F_x / agent.mass) * clampedReferenceScale;
            agent.vy += (F_y / agent.mass) * clampedReferenceScale;
        } else if (isSelf && mouse.isInteracting) {
            const interactionNoiseScale = Math.sqrt(clampedReferenceScale);
            agent.vx += (F_x + (random() - 0.5) * (dataTransferRate * 0.5) * interactionNoiseScale) * clampedReferenceScale;
            agent.vy += (F_y + (random() - 0.5) * (dataTransferRate * 0.5) * interactionNoiseScale) * clampedReferenceScale;
        }

        const friction = Math.pow(SPATIAL_FRICTION, clampedReferenceScale);
        agent.vx *= friction;
        agent.vy *= friction;

        agent.x += agent.vx * clampedReferenceScale;
        agent.y += agent.vy * clampedReferenceScale;

        // Age ambient particles
        if (agent.life !== undefined) {
            agent.life += 0.01 * clampedReferenceScale;
            if (
                agent.life > 10 ||
                agent.x < 0 ||
                agent.x > width ||
                agent.y < 0 ||
                agent.y > height
            ) {
                agents.splice(i, 1);
                i--;
            }
        }
    }
}
