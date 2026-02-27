"use client";

import { useEffect, useRef } from "react";
import type { SpatialData } from "../simulation/usePhysicsEngine";
import {
  MAX_AUDIO_DISTANCE,
  AMBIENT_LOWPASS_CAP,
  MIN_LOWPASS_FREQ,
  ACTIVE_LOWPASS_CAP,
} from "@/lib/physicsConstants";

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

  // Initialize global audio graph ONCE
  useEffect(() => {
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const panner = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter();
    const masterGain = ctx.createGain();

    filter.type = "lowpass";
    filter.frequency.value = MIN_LOWPASS_FREQ;
    filter.Q.value = 1;

    panner.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    nodesRef.current = { panner, filter, masterGain, source: null };

    const updateAudioSpatial = () => {
      if (!spatialDataRef.current || !nodesRef.current) return;

      const { distanceToNode, pan, isActive, latent } = spatialDataRef.current;
      const { panner: p, filter: f, masterGain: g } = nodesRef.current;

      p.pan.setTargetAtTime(isActive ? 0 : pan, ctx.currentTime, 0.1);

      if (!isActive && (distanceToNode === Infinity || latent.x === 0)) {
        g.gain.setTargetAtTime(0.0, ctx.currentTime, 0.1);
        return;
      }

      let volume = 0;
      if (isActive) {
        volume = 1.0;
      } else {
        if (distanceToNode < 50) {
          volume = 1.0;
        } else if (distanceToNode < MAX_AUDIO_DISTANCE) {
          const normalizedDist = (distanceToNode - 50) / (MAX_AUDIO_DISTANCE - 50);
          volume = Math.pow(1.0 - normalizedDist, 2);
        } else {
          volume = 0.05;
        }
      }

      g.gain.setTargetAtTime(Math.max(0.01, volume), ctx.currentTime, 0.2);

      const maxFreq = isActive ? ACTIVE_LOWPASS_CAP : AMBIENT_LOWPASS_CAP;
      const targetFreq =
        volume === 1.0
          ? maxFreq
          : MIN_LOWPASS_FREQ + (maxFreq - MIN_LOWPASS_FREQ) * Math.pow(volume, 1.5);

      f.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.2);
    };

    const intervalId = setInterval(updateAudioSpatial, 50);

    return () => {
      clearInterval(intervalId);
      ctx.close();
      audioContextRef.current = null;
      nodesRef.current = null;
    };
  }, [spatialDataRef]);

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
    audioContext: audioContextRef.current,
    resumeAudio: () => audioContextRef.current?.resume(),
  };
}
