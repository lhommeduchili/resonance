import { logger } from "@/lib/logger";
import type { AudioProfileMode } from "@/lib/audio/profiles";
import { AUDIO_PROFILES } from "@/lib/audio/profiles";
import { createLimitedStream, type LimiterSession } from "@/lib/audio/broadcastLimiter";
import { eventBus } from "@/lib/eventBus";
import { applyRemoteSignal, emitCandidate, emitDescription } from "@/lib/p2p/signalTransport";
import type { NostrSignaler } from "@/lib/p2p/nostrSignal";
import type { P2PTransportFactory } from "@/lib/p2p/transport/factory";
import type { BroadcasterStatus, CuratorialGraph, PeerMapEntry, SignalPayload } from "@/lib/types";
import { browserIdentity } from "@/lib/auth/identityProvider";

type BroadcasterTransportCallbacks = {
  onStatusChange: (status: BroadcasterStatus) => void;
  onErrorChange: (detail: string | null) => void;
  onListenersChange: (count: number) => void;
  onGlobalPeerMapChange: (peers: PeerMapEntry[]) => void;
  onNpubChange: (npub: string | null) => void;
  onActiveStreamChange: (stream: MediaStream | null) => void;
};

type StartBroadcastOptions = {
  deviceId?: string;
  profile: AudioProfileMode;
  graph: CuratorialGraph;
  onLiveStreamAcquired?: () => void;
};

export class BroadcasterTransport {
  private signaler: NostrSignaler | null = null;
  private stream: MediaStream | null = null;
  private currentDeviceId?: string;
  private activeProfile: AudioProfileMode;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private reportInterval: ReturnType<typeof setInterval> | null = null;
  private limiter: LimiterSession | null = null;
  private topologyPeers: PeerMapEntry[] = [];
  private activeGraph: CuratorialGraph | null = null;

  constructor(
    private readonly transportFactory: P2PTransportFactory,
    private readonly callbacks: BroadcasterTransportCallbacks,
    initialProfile: AudioProfileMode,
  ) {
    this.activeProfile = initialProfile;
  }

  dispose(): void {
    this.stopBroadcast();
  }

  async startBroadcast(options: StartBroadcastOptions): Promise<void> {
    this.callbacks.onStatusChange("CONNECTING");
    this.callbacks.onErrorChange(null);
    this.currentDeviceId = options.deviceId;
    this.activeProfile = options.profile;
    this.activeGraph = options.graph;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...AUDIO_PROFILES[this.activeProfile].constraints,
          ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : {}),
        },
        video: false,
      };

      const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = rawStream;
      this.callbacks.onActiveStreamChange(rawStream);

      const limiter = createLimitedStream(rawStream, this.activeProfile);
      this.limiter = limiter;

      options.onLiveStreamAcquired?.();

      const signaler = this.transportFactory.createSignaler(browserIdentity.getSecretKey());
      this.signaler = signaler;
      this.callbacks.onNpubChange(signaler.publicKey);

      signaler.subscribeToSignals(async (senderPubKey: string, signal: SignalPayload) => {
        const currentStream = this.limiter?.outputStream ?? this.stream;
        if (!currentStream) return;
        await this.handleSignal(senderPubKey, signal, currentStream, signaler);
      });

      signaler.subscribeToTopology((peers: PeerMapEntry[]) => {
        this.topologyPeers = peers;
        this.publishGlobalPeerMap(signaler.publicKey);
      });

      this.callbacks.onStatusChange("LIVE");
      eventBus.emit(
        "broadcast_started",
        {
          broadcasterId: signaler.publicKey,
          graphId: options.graph.id,
          graphName: options.graph.name,
        },
        { source: "broadcaster" },
      );

      signaler.updatePresenceData(
        "root",
        { x: window.innerWidth / 2, y: window.innerHeight / 2, spin: 0.5 },
        this.peerConnections.size,
        100,
        options.graph,
      );
      signaler.startPresenceBeacon();

      this.reportInterval = setInterval(() => {
        this.publishGlobalPeerMap(signaler.publicKey);

        signaler.updatePresenceData(
          "root",
          { x: window.innerWidth / 2, y: window.innerHeight / 2, spin: 0.5 },
          this.peerConnections.size,
          100,
          options.graph,
        );
      }, 5000);
    } catch (error: unknown) {
      logger.error("P2P-Broadcaster", "Failed to start broadcast", error);
      this.callbacks.onStatusChange("ERROR");
      this.callbacks.onErrorChange(error instanceof Error ? error.message || error.name : String(error));
    }
  }

  stopBroadcast(): void {
    if (this.limiter) {
      this.limiter.destroy();
      this.limiter = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.callbacks.onActiveStreamChange(null);

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.callbacks.onListenersChange(0);

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    if (this.signaler) {
      if (this.signaler.publicKey) {
        eventBus.emit(
          "broadcast_ended",
          { broadcasterId: this.signaler.publicKey },
          { source: "broadcaster" },
        );
      }
      this.signaler.close();
      this.signaler = null;
    }

    this.callbacks.onStatusChange("IDLE");
    this.callbacks.onErrorChange(null);
    this.callbacks.onNpubChange(null);
    this.activeGraph = null;
    this.topologyPeers = [];
    this.callbacks.onGlobalPeerMapChange([]);
  }

  async changeDevice(deviceId: string): Promise<void> {
    if (!this.stream) return;

    this.currentDeviceId = deviceId;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...AUDIO_PROFILES[this.activeProfile].constraints,
          deviceId: { exact: deviceId },
        },
        video: false,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newAudioTrack = newStream.getAudioTracks()[0];

      this.peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) {
          sender.replaceTrack(newAudioTrack);
        }
      });

      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = newStream;
      this.callbacks.onActiveStreamChange(newStream);
    } catch (error) {
      logger.error("P2P-Broadcaster", "Failed to swap audio device", error);
    }
  }

  async changeAudioProfile(profileId: AudioProfileMode): Promise<void> {
    if (this.activeProfile === profileId) return;

    this.activeProfile = profileId;
    if (!this.stream) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...AUDIO_PROFILES[profileId].constraints,
          ...(this.currentDeviceId ? { deviceId: { exact: this.currentDeviceId } } : {}),
        },
        video: false,
      };

      const newRawStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.limiter) {
        this.limiter.destroy();
      }
      const limiter = createLimitedStream(newRawStream, profileId);
      this.limiter = limiter;

      const newAudioTrack = limiter.outputStream.getAudioTracks()[0];
      this.peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (sender) {
          sender.replaceTrack(newAudioTrack);
        }
      });

      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = newRawStream;
      this.callbacks.onActiveStreamChange(newRawStream);

      eventBus.emit("audio_profile_changed", { profile: profileId }, { source: "broadcaster" });
    } catch (error) {
      logger.error("P2P-Broadcaster", `Failed to swap audio profile to ${profileId}`, error);
    }
  }

  private async handleSignal(
    senderPubKey: string,
    signal: SignalPayload,
    stream: MediaStream,
    signaler: NostrSignaler,
  ): Promise<void> {
    let pc = this.peerConnections.get(senderPubKey);

    if (signal.type === "offer") {
      if (pc) {
        pc.close();
        this.peerConnections.delete(senderPubKey);
      }
      pc = this.createPeerConnection(senderPubKey, stream, signaler);
      await applyRemoteSignal(pc, signal);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emitDescription(signaler, senderPubKey, answer);
      return;
    }

    if (signal.type === "answer" && pc) {
      await applyRemoteSignal(pc, signal);
      return;
    }

    if (signal.type === "candidate" && pc) {
      await applyRemoteSignal(pc, signal);
    }
  }

  private createPeerConnection(
    targetId: string,
    stream: MediaStream,
    signaler: NostrSignaler,
  ): RTCPeerConnection {
    const pc = this.transportFactory.createPeerConnection();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(signaler, targetId, event.candidate);
      }
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    this.peerConnections.set(targetId, pc);

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        pc.close();
        this.peerConnections.delete(targetId);
      }
      this.callbacks.onListenersChange(this.peerConnections.size);
    };

    return pc;
  }

  private publishGlobalPeerMap(publicKey: string): void {
    this.callbacks.onGlobalPeerMapChange([
      {
        id: publicKey,
        role: "root",
        latentState: { x: window.innerWidth / 2, y: window.innerHeight / 2, spin: 0.5 },
        connections: this.peerConnections.size,
        energy: 100,
        activeCuratorialGraph: this.activeGraph ?? undefined,
      },
      ...this.topologyPeers,
    ]);
  }
}
