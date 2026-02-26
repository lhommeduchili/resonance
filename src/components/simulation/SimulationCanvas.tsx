"use client";

import { useEffect, useRef } from "react";

/**
 * The core visualizer for Resonance.
 * Renders the physics state directly to a 2D canvas.
 * Avoids React-level state for nodes/particles to maintain 60FPS.
 */
export function SimulationCanvas({ isActive = false }: { isActive?: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Handle Resize
        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            // Increase pixel ratio for retina screens
            const ratio = window.devicePixelRatio || 1;
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            ctx.scale(ratio, ratio);
        };

        window.addEventListener("resize", resize);
        resize();

        // The Simulation State (Local to the rendering loop for now)
        // Eventually this will sync with WebRTC events and a central Physis engine
        type Particle = { x: number; y: number; vx: number; vy: number; life: number; id: number };
        const particles: Particle[] = [];

        // Populate root broadcast node only if active
        const nodes = isActive
            ? [{ id: "broadcast-1", x: width / 2, y: height / 2, pulsePhase: 0 }]
            : [];

        let animationId: number;
        let time = 0;

        const loop = () => {
            time += 0.016; // Approx 60fps dt

            // Clear with slight trailing effect (alpha 0.2)
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.fillRect(0, 0, width, height);

            // Draw Nodes (Broadcasts)
            for (const node of nodes) {
                node.pulsePhase += 0.05;
                const pulse = Math.sin(node.pulsePhase) * 2 + 6;

                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
                ctx.fill();

                // Node Halo (Energy/Density)
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(node.pulsePhase) * 0.05})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 20 + pulse, 0, Math.PI * 2);
                ctx.stroke();

                // Second outer ring
                ctx.beginPath();
                ctx.arc(node.x, node.y, 40 + pulse * 1.5, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Spawn random particles drifting (exploration/noise)
            if (Math.random() < 0.1) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    life: 0,
                    id: Math.random()
                });
            }

            // Draw Particles (Listeners/Relays)
            ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life += 0.01;

                // Gravity towards center node (Attraction effect)
                if (nodes.length > 0) {
                    const dx = nodes[0].x - p.x;
                    const dy = nodes[0].y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 50 && dist < 300) {
                        p.vx += (dx / dist) * 0.01;
                        p.vy += (dy / dist) * 0.01;
                    }

                    // Draw particle trail / connection line if close to node
                    if (dist < 150) {
                        ctx.strokeStyle = `rgba(150, 150, 150, ${(150 - dist) / 150 * 0.2})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(nodes[0].x, nodes[0].y);
                        ctx.stroke();
                    }
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
                ctx.fill();

                // Remove old particles
                if (p.life > 10 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
                    particles.splice(i, 1);
                }
            }

            animationId = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            window.removeEventListener("resize", resize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            style={{ touchAction: "none" }}
        />
    );
}
