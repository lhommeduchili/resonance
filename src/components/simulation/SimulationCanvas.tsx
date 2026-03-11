"use client";

import { useEffect, useRef } from "react";
import { usePhysicsEngine } from "./usePhysicsEngine";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import type { PeerMapEntry } from "@/lib/types";
import type { SpatialData } from "@/lib/simulation/contracts";

/**
 * The core visualizer for Resonance.
 * Renders the physics state directly to a 2D canvas via the usePhysicsEngine hook.
 */
export function SimulationCanvas({
    isActive = false,
    isListener = false,
    dataTransferRate = 1.0,
    spatialDataRef,
    globalPeerMap = [],
    socketId = null,
    connectedNodeId = null,
    isReady = true,
    activeProfile = "VOICE"
}: {
    isActive?: boolean;
    isListener?: boolean;
    dataTransferRate?: number;
    spatialDataRef: React.MutableRefObject<SpatialData>;
    globalPeerMap?: PeerMapEntry[];
    socketId?: string | null;
    connectedNodeId?: string | null;
    isReady?: boolean;
    activeProfile?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const hoveredNodeIdRef = useRef<string | null>(null);
    const engine = usePhysicsEngine(isActive, isListener, dataTransferRate, spatialDataRef, connectedNodeId, isReady, activeProfile);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctxRef.current = ctx;

        // Handle Resize
        let width = window.innerWidth;
        let height = window.innerHeight;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            const ratio = window.devicePixelRatio || 1;
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(ratio, ratio);
        };

        window.addEventListener("resize", resize);
        resize();

        // Mouse Tracking
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            engine.handleMouseMove(e.clientX - rect.left, e.clientY - rect.top);
        };

        const handleClick = () => {
            engine.handleClick(hoveredNodeIdRef.current);
        };

        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("click", handleClick);

        return () => {
            window.removeEventListener("resize", resize);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("click", handleClick);
        };
    }, [engine]);

    // Handle the Animation Frame Loop
    useAnimationFrame((deltaMs) => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        engine.updatePeers(globalPeerMap, socketId);
        engine.tick(ctx, width, height, deltaMs);
        hoveredNodeIdRef.current = spatialDataRef.current?.hoveredNodeId ?? null;
    });

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            style={{ touchAction: "none" }}
        />
    );
}
