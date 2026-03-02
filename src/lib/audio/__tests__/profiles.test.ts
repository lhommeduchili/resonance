import { describe, it, expect } from "vitest";
import { AUDIO_PROFILES, DEFAULT_AUDIO_PROFILE } from "../profiles";

describe("Audio Profiles", () => {
    it("should define a VOICE profile with standard noise reduction enabled", () => {
        const profile = AUDIO_PROFILES.VOICE;
        expect(profile.id).toBe("VOICE");
        expect(profile.constraints.echoCancellation).toBe(true);
        expect(profile.constraints.noiseSuppression).toBe(true);
        expect(profile.constraints.autoGainControl).toBe(true);
        expect(profile.constraints.channelCount).toBe(1);
    });

    it("should define a HIGH_FIDELITY profile with noise reduction disabled", () => {
        const profile = AUDIO_PROFILES.HIGH_FIDELITY;
        expect(profile.id).toBe("HIGH_FIDELITY");
        expect(profile.constraints.echoCancellation).toBe(false);
        expect(profile.constraints.noiseSuppression).toBe(false);
        expect(profile.constraints.autoGainControl).toBe(false);
        expect(profile.constraints.channelCount).toBe(2);
        expect(profile.constraints.sampleRate).toBe(48000);
    });

    it("should export VOICE as the default profile", () => {
        expect(DEFAULT_AUDIO_PROFILE.id).toBe("VOICE");
    });
});
