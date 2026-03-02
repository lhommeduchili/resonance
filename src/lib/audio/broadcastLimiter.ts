/**
 * Broadcast Limiter
 *
 * Transparent brick-wall limiter that sits between getUserMedia and WebRTC
 * senders. Uses a DynamicsCompressorNode configured with a high threshold
 * so normal-level audio passes through untouched, while runaway gain
 * (e.g. feedback loops) gets clamped instantly.
 *
 * Profile-aware: VOICE gets a gentler compressor (the browser's own echo
 * cancellation does most of the work); HIGH_FIDELITY gets an aggressive
 * brick-wall limiter since all browser safeguards are disabled.
 */

import type { AudioProfileMode } from "./profiles";

// ---------------------------------------------------------------------------
// Limiter presets per profile
// ---------------------------------------------------------------------------

interface LimiterPreset {
    threshold: number; // dBFS — signals above this get compressed
    knee: number;      // dB — soft/hard transition width
    ratio: number;     // compression ratio (20+ = brick wall)
    attack: number;    // seconds — how fast the limiter engages
    release: number;   // seconds — how fast it releases
}

const LIMITER_PRESETS: Record<AudioProfileMode, LimiterPreset> = {
    VOICE: {
        threshold: -6,   // Gentle — browser echo cancellation handles most issues
        knee: 10,
        ratio: 12,
        attack: 0.003,
        release: 0.25,
    },
    HIGH_FIDELITY: {
        threshold: -3,   // Brick-wall — catch feedback loops immediately
        knee: 0,         // Hard knee = instant clamping above threshold
        ratio: 20,       // Near-infinite ratio = true limiter behavior
        attack: 0.001,   // 1ms attack — fastest possible without artifacts
        release: 0.1,    // Fast release to stay transparent on transients
    },
};

// ---------------------------------------------------------------------------
// Limiter session — holds the Web Audio pipeline
// ---------------------------------------------------------------------------

export interface LimiterSession {
    /** The processed stream to feed into WebRTC senders. */
    outputStream: MediaStream;
    /** Tear down the audio context and nodes. */
    destroy: () => void;
}

/**
 * Create a limited audio stream from a raw getUserMedia stream.
 *
 * The pipeline is:
 *   MediaStreamSource → DynamicsCompressor → MediaStreamDestination
 *
 * The returned `outputStream` should replace the raw stream when adding
 * tracks to RTCPeerConnection senders.
 */
export function createLimitedStream(
    rawStream: MediaStream,
    profile: AudioProfileMode,
): LimiterSession {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(rawStream);

    const compressor = ctx.createDynamicsCompressor();
    const preset = LIMITER_PRESETS[profile];

    compressor.threshold.value = preset.threshold;
    compressor.knee.value = preset.knee;
    compressor.ratio.value = preset.ratio;
    compressor.attack.value = preset.attack;
    compressor.release.value = preset.release;

    const destination = ctx.createMediaStreamDestination();

    source.connect(compressor);
    compressor.connect(destination);

    return {
        outputStream: destination.stream,
        destroy: () => {
            source.disconnect();
            compressor.disconnect();
            ctx.close().catch(() => { /* ignore close errors on teardown */ });
        },
    };
}
