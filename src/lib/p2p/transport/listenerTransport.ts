import { logger } from "@/lib/logger";
import type { LatentState, ListenerStatus, PeerMapEntry, SignalPayload } from "@/lib/types";
import { eventBus } from "@/lib/eventBus";
import { emitCandidate, emitDescription, applyRemoteSignal } from "@/lib/p2p/signalTransport";
import type { NostrSignaler } from "@/lib/p2p/nostrSignal";
import type { P2PTransportFactory } from "@/lib/p2p/transport/factory";
import { browserIdentity } from "@/lib/auth/identityProvider";

type ListenerTransportCallbacks = {
  onStatusChange: (status: ListenerStatus) => void;
  onActivePeersChange: (count: number) => void;
  onGlobalPeerMapChange: (peers: PeerMapEntry[]) => void;
  onNpubChange: (npub: string | null) => void;
  onAudioStreamChange: (stream: MediaStream | null) => void;
  onUpstreamTargetChange: (targetId: string | null) => void;
};

export class ListenerTransport {
  private signaler: NostrSignaler | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private status: ListenerStatus = "AMBIENT";
  private upstreamTargetId: string | null = null;
  private upstreamPc: RTCPeerConnection | null = null;
  private pendingUpstreamPc: RTCPeerConnection | null = null;
  private downstreamPcs = new Map<string, RTCPeerConnection>();
  private audioStream: MediaStream | null = null;
  private reconnectAttempts = 0;
  private lastReportedLatent: (LatentState & { timestamp?: number }) | null = null;
  private lastPeerMap: PeerMapEntry[] = [];
  private lastSocketId: string | null = null;
  private triedPeers = new Set<string>();

  constructor(
    private readonly transportFactory: P2PTransportFactory,
    private readonly callbacks: ListenerTransportCallbacks,
  ) {}

  init(): void {
    this.audioElement = new Audio();
    this.audioElement.autoplay = true;
    this.audioElement.muted = true;
    this.audioElement.volume = 0;

    const signaler = this.transportFactory.createSignaler(browserIdentity.getSecretKey());
    this.signaler = signaler;
    this.callbacks.onNpubChange(signaler.publicKey);
    this.lastSocketId = signaler.publicKey;

    signaler.subscribeToSignals(async (senderPubKey: string, signal: SignalPayload) => {
      await this.handleSignal(senderPubKey, signal);
    });

    signaler.subscribeToTopology((peers: PeerMapEntry[]) => {
      this.lastPeerMap = peers;
      this.callbacks.onGlobalPeerMapChange(peers);
      this.callbacks.onActivePeersChange(Math.max(0, peers.length));
      this.tryAmbientConnect(peers);
    });

    const initialLatent = {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      spin: Math.random(),
    };
    this.lastReportedLatent = { ...initialLatent };

    signaler.updatePresenceData("observer", initialLatent, this.downstreamPcs.size, 10);
    signaler.startPresenceBeacon();
  }

  dispose(): void {
    this.stopListening();
    if (this.signaler) {
      this.signaler.close();
      this.signaler = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }
    this.callbacks.onNpubChange(null);
    this.callbacks.onGlobalPeerMapChange([]);
  }

  getUpstreamPeerConnection(): RTCPeerConnection | null {
    return this.upstreamPc;
  }

  stopListening(): void {
    if (this.upstreamPc) {
      this.upstreamPc.close();
      this.upstreamPc = null;
    }
    if (this.pendingUpstreamPc) {
      this.pendingUpstreamPc.close();
      this.pendingUpstreamPc = null;
    }

    this.downstreamPcs.forEach((pc) => pc.close());
    this.downstreamPcs.clear();

    this.upstreamTargetId = null;
    this.callbacks.onUpstreamTargetChange(null);

    this.setStatus("AMBIENT");

    this.audioStream = null;
    this.callbacks.onAudioStreamChange(null);
    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }

    if (this.signaler?.publicKey) {
      eventBus.emit("listener_left", { nodeId: this.signaler.publicKey }, { source: "listener" });
    }
  }

  untuneFromBroadcast(): void {
    this.setStatus("AMBIENT");
    if (this.signaler?.publicKey) {
      eventBus.emit("listener_left", { nodeId: this.signaler.publicKey }, { source: "listener" });
    }
  }

  unlockAudio(): void {
    if (this.audioElement) {
      this.audioElement.play().catch((error) => {
        logger.warn("P2P-Listener", "Audio auto-play blocked", error);
      });
    }
  }

  reportLatentUpdate(newState: LatentState): void {
    if (!this.signaler) return;

    const oldState = this.lastReportedLatent;
    if (oldState) {
      const distSq = Math.pow(newState.x - oldState.x, 2) + Math.pow(newState.y - oldState.y, 2);
      const spinDiff = Math.abs(newState.spin - oldState.spin);

      if (distSq <= 2500 && spinDiff <= 0.05) {
        return;
      }

      const now = Date.now();
      if (oldState.timestamp && now - oldState.timestamp <= 10_000) {
        return;
      }

      this.signaler.updatePresenceData(
        this.audioStream ? "relay" : "observer",
        newState,
        this.downstreamPcs.size,
        10,
      );
      this.lastReportedLatent = { ...newState, timestamp: now };
      return;
    }

    const now = Date.now();
    this.signaler.updatePresenceData(
      this.audioStream ? "relay" : "observer",
      newState,
      this.downstreamPcs.size,
      10,
    );
    this.lastReportedLatent = { ...newState, timestamp: now };
  }

  async startListening(targetNodeId?: string): Promise<void> {
    if (!this.signaler || !targetNodeId) return;
    if (this.status === "LISTENING" && this.upstreamTargetId === targetNodeId) return;

    logger.info("P2P-Listener", `Explicitly tuning into broadcast: ${targetNodeId}`);

    if (this.upstreamPc && this.upstreamTargetId !== targetNodeId) {
      const swapPc = this.createUpstreamConnection(targetNodeId, this.signaler);
      this.pendingUpstreamPc = swapPc;
      const offer = await swapPc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await swapPc.setLocalDescription(offer);
      emitDescription(this.signaler, targetNodeId, offer);
      this.setStatus("CONNECTING");
      return;
    }

    if (!this.upstreamPc) {
      this.upstreamTargetId = targetNodeId;
      this.callbacks.onUpstreamTargetChange(targetNodeId);
      const pc = this.createUpstreamConnection(targetNodeId, this.signaler);
      this.upstreamPc = pc;
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      emitDescription(this.signaler, targetNodeId, offer);
      this.setStatus("CONNECTING");
      return;
    }

    this.setStatus("LISTENING");
  }

  private async startAmbientListening(targetNodeId: string): Promise<void> {
    if (!this.signaler || this.upstreamPc) return;

    logger.info("P2P-Listener", `Initializing ambient connection to: ${targetNodeId}`);
    this.upstreamTargetId = targetNodeId;
    this.callbacks.onUpstreamTargetChange(targetNodeId);

    const pc = this.createUpstreamConnection(targetNodeId, this.signaler);
    this.upstreamPc = pc;
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    emitDescription(this.signaler, targetNodeId, offer);

      setTimeout(() => {
        if (this.upstreamPc === pc && !this.audioStream) {
          logger.warn("P2P-Listener", `Connection to ${targetNodeId.slice(0, 8)} timed out - marking as stale`);
          this.triedPeers.add(targetNodeId);
          pc.close();
          this.upstreamPc = null;
          // Only nullify target if it was an ambient connect
          if (this.upstreamTargetId === targetNodeId) {
            this.upstreamTargetId = null;
            this.callbacks.onUpstreamTargetChange(null);
            this.setStatus("AMBIENT");
          }
        }
      }, 15_000);
  }

  private tryAmbientConnect(peerMap: PeerMapEntry[]): void {
    if (this.status !== "AMBIENT" || this.upstreamPc || peerMap.length === 0) {
      return;
    }

    const possibleNodes = peerMap.filter(
      (peer) => (peer.role === "root" || peer.role === "relay") && !this.triedPeers.has(peer.id),
    );

    if (possibleNodes.length === 0) {
      return;
    }

    const myLatent = this.lastReportedLatent;
    let bestNode = possibleNodes[0];

    if (myLatent) {
      let minScore = Infinity;
      for (const node of possibleNodes) {
        if (!node.latentState) continue;
        const distSq =
          Math.pow(node.latentState.x - myLatent.x, 2) +
          Math.pow(node.latentState.y - myLatent.y, 2);
        if (distSq < minScore) {
          minScore = distSq;
          bestNode = node;
        }
      }
    }

    this.startAmbientListening(bestNode.id).catch((error) => {
      logger.error("P2P-Listener", "Ambient connect failed", error);
    });
  }

  private createUpstreamConnection(targetId: string, signaler: NostrSignaler): RTCPeerConnection {
    const pc = this.transportFactory.createPeerConnection();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(signaler, targetId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      logger.info("P2P-Listener", "[PC] Upstream track received from", targetId);

      if (this.pendingUpstreamPc === pc && this.upstreamPc) {
        this.upstreamPc.close();
        this.upstreamPc = pc;
        this.pendingUpstreamPc = null;
      } else if (!this.upstreamPc) {
        this.upstreamPc = pc;
      }

      this.reconnectAttempts = 0;
      this.upstreamTargetId = targetId;
      this.callbacks.onUpstreamTargetChange(targetId);

      if (event.streams[0]) {
        const stream = event.streams[0];
        this.downstreamPcs.forEach((childPc) => {
          const senders = childPc.getSenders();
          stream.getTracks().forEach((track) => {
            const existingSender = senders.find((sender) => sender.track?.kind === track.kind);
            if (existingSender) {
              existingSender.replaceTrack(track).catch((error) => {
                logger.warn("P2P-Listener", "Failed to replace relay track", error);
              });
            } else {
              childPc.addTrack(track, stream);
            }
          });
        });
      }

      if (this.audioElement && event.streams[0]) {
        this.audioElement.srcObject = event.streams[0];
        this.audioElement.play().catch((error) => {
          logger.warn("P2P-Listener", "Audio auto-play blocked", error);
        });
        this.audioStream = event.streams[0];
        this.callbacks.onAudioStreamChange(event.streams[0]);

        if (this.status === "CONNECTING") {
          this.setStatus("LISTENING");
          if (this.signaler?.publicKey) {
            eventBus.emit(
              "listener_joined",
              { nodeId: this.signaler.publicKey, channelId: targetId },
              { source: "listener" },
            );
          }
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== "disconnected" && pc.connectionState !== "failed") {
        return;
      }

      logger.info("P2P-Listener", "[PC] Upstream disconnected");
      pc.close();

      if (this.signaler?.publicKey) {
        eventBus.emit("listener_left", { nodeId: this.signaler.publicKey }, { source: "listener" });
      }

      if (this.upstreamPc === pc) {
        this.upstreamPc = null;
        
        if (this.status === "LISTENING") {
          this.setStatus("CONNECTING");
        }
        if (this.audioElement) {
          this.audioElement.srcObject = null;
        }
        this.audioStream = null;
        this.callbacks.onAudioStreamChange(null);

        if (this.upstreamTargetId) {
          const targetToReconnect = this.upstreamTargetId;
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
          const jitter = Math.random() * 1000;
          
          logger.info("P2P-Listener", `Scheduling reconnect to ${targetToReconnect} in ${Math.round(delay + jitter)}ms (attempt ${this.reconnectAttempts})`);
          
          setTimeout(() => {
            if (this.upstreamTargetId === targetToReconnect && !this.upstreamPc) {
              this.startListening(targetToReconnect).catch((error) => {
                logger.error("P2P-Listener", "Reconnect failed", error);
              });
            }
          }, delay + jitter);
        } else {
          this.callbacks.onUpstreamTargetChange(null);
        }

        return;
      }

      if (this.pendingUpstreamPc === pc) {
        this.pendingUpstreamPc = null;
      }
    };

    if (!this.upstreamPc && !this.pendingUpstreamPc) {
      this.upstreamPc = pc;
    }

    return pc;
  }

  private createDownstreamConnection(
    targetId: string,
    stream: MediaStream | null,
    signaler: NostrSignaler,
  ): RTCPeerConnection {
    const pc = this.transportFactory.createPeerConnection();

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emitCandidate(signaler, targetId, event.candidate);
      }
    };

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== "disconnected" && pc.connectionState !== "failed") {
        return;
      }
      pc.close();
      this.downstreamPcs.delete(targetId);
      this.callbacks.onActivePeersChange(this.downstreamPcs.size);
    };

    this.downstreamPcs.set(targetId, pc);
    this.callbacks.onActivePeersChange(this.downstreamPcs.size);
    return pc;
  }

  private async handleSignal(senderPubKey: string, signal: SignalPayload): Promise<void> {
    if (!this.signaler) return;

    if (signal.type === "answer" && this.upstreamPc) {
      if (this.upstreamPc.signalingState === "have-local-offer") {
        await applyRemoteSignal(this.upstreamPc, signal).catch((error) => {
          logger.warn("P2P-Listener", "Failed to set remote answer", error);
        });
      } else {
        logger.warn(
          "P2P-Listener",
          `Ignored answer because signalingState is ${this.upstreamPc.signalingState}`,
        );
      }
      return;
    }

    if (signal.type === "offer") {
      let childPc = this.downstreamPcs.get(senderPubKey);
      if (childPc) {
        logger.info("P2P-Listener", "[PC] Replacing stale downstream connection for offer from", senderPubKey);
        childPc.close();
        this.downstreamPcs.delete(senderPubKey);
      }
      childPc = this.createDownstreamConnection(senderPubKey, this.audioStream, this.signaler);

      await applyRemoteSignal(childPc, signal);
      const answer = await childPc.createAnswer();
      await childPc.setLocalDescription(answer);
      emitDescription(this.signaler, senderPubKey, answer);
      return;
    }

    if (signal.type === "candidate") {
      if (this.upstreamPc && this.upstreamPc.remoteDescription) {
        await applyRemoteSignal(this.upstreamPc, signal).catch((error) => {
          logger.warn("P2P-Listener", "Failed to apply upstream candidate", error);
        });
      }
      const childPc = this.downstreamPcs.get(senderPubKey);
      if (childPc && childPc.remoteDescription) {
        await applyRemoteSignal(childPc, signal).catch((error) => {
          logger.warn("P2P-Listener", "Failed to apply downstream candidate", error);
        });
      }
    }
  }

  private setStatus(status: ListenerStatus): void {
    this.status = status;
    this.callbacks.onStatusChange(status);
  }
}
