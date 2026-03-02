"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error("System", "Uncaught Application Exception", error);
    }, [error]);

    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-black font-mono text-neutral-400">
            <h2 className="mb-4 text-xl text-red-500">[ CRITICAL SYSTEM FAILURE ]</h2>
            <p className="mb-8 text-sm max-w-lg text-center">
                The Resonance field encountered an irrecoverable state paradox.
                {error.message && <span className="block mt-2 text-neutral-500">{error.message}</span>}
            </p>
            <button
                onClick={() => reset()}
                className="px-4 py-2 text-xs uppercase tracking-widest border border-neutral-800 hover:border-neutral-500 hover:text-white transition-colors"
            >
                Re-Initialize Engine
            </button>
        </div>
    );
}
