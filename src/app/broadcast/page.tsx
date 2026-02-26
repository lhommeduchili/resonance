"use client";

import { useBroadcaster } from "@/components/p2p/useBroadcaster";

export default function BroadcastTerminal() {
    const { status, listeners, startBroadcast, stopBroadcast } = useBroadcaster({ streamKey: "dev_key" });

    return (
        <main className="flex min-h-screen items-center justify-center p-6 bg-[#000000]">
            <div className="w-full max-w-lg border border-accent p-8 font-mono text-sm leading-relaxed">
                <header className="mb-8 border-b border-accent pb-4">
                    <h1 className="text-xl font-bold tracking-widest text-[#ffffff]">* RESONANCE INGESTION *</h1>
                    <p className="text-highlight mt-2 uppercase text-xs">Root Node Configuration</p>
                </header>

                <section className="space-y-6">
                    <div>
                        <span className="block text-accent uppercase tracking-widest text-xs mb-1">State:</span>
                        <span className={`uppercase font-bold ${status === 'LIVE' ? 'text-green-500' : 'text-foreground'}`}>
                            [ {status} ]
                        </span>
                    </div>

                    <div>
                        <span className="block text-accent uppercase tracking-widest text-xs mb-1">Direct Peers:</span>
                        <span className="text-foreground">
                            {listeners} / ∞
                        </span>
                    </div>

                    <div className="pt-8">
                        {status === "IDLE" || status === "ERROR" ? (
                            <button
                                onClick={startBroadcast}
                                className="w-full border border-foreground hover:bg-foreground hover:text-black py-4 uppercase tracking-widest transition-colors cursor-pointer"
                            >
                                Ignite Transmission
                            </button>
                        ) : (
                            <button
                                onClick={stopBroadcast}
                                className="w-full border border-red-900 text-red-500 hover:bg-red-900 hover:text-white py-4 uppercase tracking-widest transition-colors cursor-pointer"
                            >
                                Collapse Signal
                            </button>
                        )}
                        {status === "ERROR" && <p className="text-red-500 text-xs mt-2 text-center uppercase">Microphone access denied or server offline.</p>}
                    </div>
                </section>
            </div>
        </main>
    );
}
