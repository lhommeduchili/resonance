export type AudioProfileMode = "VOICE" | "HIGH_FIDELITY";

export interface AudioProfile {
    id: AudioProfileMode;
    label: string;
    constraints: MediaTrackConstraints;
}

export const AUDIO_PROFILES: Record<AudioProfileMode, AudioProfile> = {
    VOICE: {
        id: "VOICE",
        label: "Voice Mode",
        constraints: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1, // Mono is usually sufficient for voice and saves bandwidth
        },
    },
    HIGH_FIDELITY: {
        id: "HIGH_FIDELITY",
        label: "High-Fidelity Mode",
        constraints: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2, // Stereo for music
            sampleRate: 48000, // Standard high-quality sample rate
            sampleSize: 16,
        },
    },
};

export const DEFAULT_AUDIO_PROFILE = AUDIO_PROFILES.VOICE;
