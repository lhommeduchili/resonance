"use client";

import { useEffect, useRef, useState } from "react";
import type { SpatialData } from "@/lib/simulation/contracts";
import {
  MAX_AUDIO_DISTANCE,
  AMBIENT_LOWPASS_CAP,
  MIN_LOWPASS_FREQ,
} from "@/lib/physicsConstants";
import { logger } from "@/lib/logger";

export function useSpatialAudio(
  stream: MediaStream | null,
  spatialDataRef: React.MutableRefObject<SpatialData>,
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{
    panner: StereoPannerNode;
    filter: BiquadFilterNode;
    masterGain: GainNode;
    source: MediaStreamAudioSourceNode | null;
  } | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep streamRef in sync so initAudio can access it
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const initAudio = () => {
    if (isInitialized || audioContextRef.current) return;

    // Explicitly invoked by user click
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const panner = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter();
    const masterGain = ctx.createGain();

    // Safety limiter: transparent brick-wall to catch feedback loops
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    filter.type = "lowpass";
    filter.frequency.value = MIN_LOWPASS_FREQ;
    filter.Q.value = 1;

    panner.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(limiter);
    limiter.connect(ctx.destination);

    nodesRef.current = { panner, filter, masterGain, source: null };

    const updateAudioSpatial = () => {
      if (!spatialDataRef.current || !nodesRef.current) return;

      const { distanceToNode, pan, isActive } = spatialDataRef.current;
      const { panner: p, filter: f, masterGain: g } = nodesRef.current;

      p.pan.setTargetAtTime(isActive ? 0 : pan, ctx.currentTime, 0.1);

      let volume = 0;
      if (isActive) {
        // Explicitly tuned in — full volume, bypass distance entirely
        volume = 1.0;
      } else if (distanceToNode < 50) {
        // Close ambient — capped at 0.4 so it's clearly quieter than active (1.0)
        volume = 0.4;
      } else if (distanceToNode < MAX_AUDIO_DISTANCE) {
        const normalizedDist = (distanceToNode - 50) / (MAX_AUDIO_DISTANCE - 50);
        volume = 0.4 * Math.pow(1.0 - normalizedDist, 2);
      } else {
        // Far away or Infinity — baseline ambient hum
        volume = 0.05;
      }

      g.gain.setTargetAtTime(Math.max(0.01, volume), ctx.currentTime, 0.2);

      // When active: bypass the lowpass entirely (Nyquist = transparent).
      // When ambient: distance-dependent lowpass for the spatial "through the wall" effect.
      if (isActive) {
        f.frequency.setTargetAtTime(ctx.sampleRate / 2, ctx.currentTime, 0.05);
      } else {
        const targetFreq =
          volume >= 0.4
            ? AMBIENT_LOWPASS_CAP
            : MIN_LOWPASS_FREQ + (AMBIENT_LOWPASS_CAP - MIN_LOWPASS_FREQ) * Math.pow(volume / 0.4, 1.5);
        f.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.2);
      }
    };

    const intervalId = setInterval(updateAudioSpatial, 50);
    intervalRef.current = intervalId;

    // If a stream already arrived before initAudio was called, connect it now
    if (streamRef.current && nodesRef.current) {
      nodesRef.current.source = ctx.createMediaStreamSource(streamRef.current);
      nodesRef.current.source.connect(nodesRef.current.panner);
    }

    setIsInitialized(true);
  };

  // Clean up AudioContext strictly on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current
          .close()
          .catch((error) => logger.warn("P2P-SpatialAudio", "Failed to close audio context", error));
        audioContextRef.current = null;
      }
      nodesRef.current = null;
    }
  }, []);

  // Update MediaStream independently when it changes, avoiding suspended audio contexts
  useEffect(() => {
    if (!audioContextRef.current || !nodesRef.current) return;
    const ctx = audioContextRef.current;
    const nodes = nodesRef.current;

    // Clean up previous stream source
    if (nodes.source) {
      nodes.source.disconnect();
      nodes.source = null;
    }

    if (stream) {
      // Ensure the context is running (it may have been suspended if the
      // stream was previously null and the browser suspended the context)
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => { });
      }
      nodes.source = ctx.createMediaStreamSource(stream);
      nodes.source.connect(nodes.panner);
    }
  }, [stream]);

  return {
    isInitialized,
    initAudio,
    resumeAudio: () => audioContextRef.current?.resume(),
  };
}
