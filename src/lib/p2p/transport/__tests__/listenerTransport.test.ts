import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ListenerTransport } from "@/lib/p2p/transport/listenerTransport";
import type { P2PTransportFactory } from "@/lib/p2p/transport/factory";
import type { SignalPayload } from "@/lib/types";

class FakeSignaler {
  public publicKey = "npub_test_listener";
  public signalsSubscribed = false;
  public topologySubscribed = false;
  public presenceStarted = false;
  public immediateSignals: Array<{ target: string; signal: SignalPayload }> = [];
  public signalHandler?: (sender: string, signal: SignalPayload) => Promise<void>;

  subscribeToSignals(handler: (senderPubKey: string, signal: SignalPayload) => Promise<void>) {
    this.signalsSubscribed = true;
    this.signalHandler = handler;
  }

  subscribeToTopology() {
    this.topologySubscribed = true;
  }

  updatePresenceData() {}

  startPresenceBeacon() {
    this.presenceStarted = true;
  }

  close() {}

  sendSignalImmediate(target: string, signal: SignalPayload) {
    this.immediateSignals.push({ target, signal });
  }

  sendSignal() {}
}

class FakePeerConnection {
  public signalingState: RTCSignalingState = "stable";
  public connectionState = "connected";
  public onconnectionstatechange?: () => void;
  public ontrack?: (event: { streams: MediaStream[] }) => void;
  public remoteDescription: RTCSessionDescriptionInit | null = null;
  
  createOffer = vi.fn(async () => ({ type: "offer" as const, sdp: "fake-sdp" }));
  createAnswer = vi.fn(async () => ({ type: "answer" as const, sdp: "fake-answer" }));
  setLocalDescription = vi.fn(async () => {
    this.signalingState = "have-local-offer";
  });
  setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = desc;
    this.signalingState = "have-remote-offer";
  });
  close = vi.fn(() => { this.connectionState = "closed"; });
  addTrack = vi.fn();
  getSenders = vi.fn(() => []);
}

describe("ListenerTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes signaling and presence on init", () => {
    const fakeSignaler = new FakeSignaler();

    const callbacks = {
      onStatusChange: vi.fn(),
      onActivePeersChange: vi.fn(),
      onGlobalPeerMapChange: vi.fn(),
      onNpubChange: vi.fn(),
      onAudioStreamChange: vi.fn(),
      onUpstreamTargetChange: vi.fn(),
    };

    const factory: P2PTransportFactory = {
      createSignaler: () => fakeSignaler as never,
      createPeerConnection: () => new FakePeerConnection() as never,
    };

    const transport = new ListenerTransport(factory, callbacks);
    transport.init();

    expect(callbacks.onNpubChange).toHaveBeenCalledWith("npub_test_listener");
    expect(fakeSignaler.signalsSubscribed).toBe(true);
    expect(fakeSignaler.topologySubscribed).toBe(true);
    expect(fakeSignaler.presenceStarted).toBe(true);

    transport.dispose();
  });

  it("moves to connecting when starting explicit listening", async () => {
    const fakeSignaler = new FakeSignaler();
    const fakePc = new FakePeerConnection();

    const callbacks = {
      onStatusChange: vi.fn(),
      onActivePeersChange: vi.fn(),
      onGlobalPeerMapChange: vi.fn(),
      onNpubChange: vi.fn(),
      onAudioStreamChange: vi.fn(),
      onUpstreamTargetChange: vi.fn(),
    };

    const factory: P2PTransportFactory = {
      createSignaler: () => fakeSignaler as never,
      createPeerConnection: () => fakePc as never,
    };

    const transport = new ListenerTransport(factory, callbacks);
    transport.init();
    await transport.startListening("root-abc");

    expect(callbacks.onUpstreamTargetChange).toHaveBeenCalledWith("root-abc");
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("CONNECTING");
    expect(fakeSignaler.immediateSignals.length).toBe(1);

    transport.dispose();
  });

  it("schedules a reconnect with exponential backoff on disconnect", async () => {
    const fakeSignaler = new FakeSignaler();
    let pcInstance: FakePeerConnection | null = null;

    const factory: P2PTransportFactory = {
      createSignaler: () => fakeSignaler as never,
      createPeerConnection: () => {
        pcInstance = new FakePeerConnection();
        return pcInstance as never;
      },
    };

    const callbacks = {
      onStatusChange: vi.fn(),
      onActivePeersChange: vi.fn(),
      onGlobalPeerMapChange: vi.fn(),
      onNpubChange: vi.fn(),
      onAudioStreamChange: vi.fn(),
      onUpstreamTargetChange: vi.fn(),
    };

    const transport = new ListenerTransport(factory, callbacks);
    transport.init();

    // 1st request
    await transport.startListening("root-abc");
    expect(fakeSignaler.immediateSignals.length).toBe(1);
    
    // simulate connection to listening state to ensure status reverts to CONNECTING upon reconnect
    // (mocking getting a track)
    const pc1 = pcInstance!;
    if (pc1.ontrack) {
      pc1.ontrack({ streams: [{} as MediaStream] });
    }

    // fake disconnect to trigger reconnect scheduling
    pc1.connectionState = "disconnected";
    pc1.onconnectionstatechange?.();

    // fast forward 2000ms (max delay 2000 + jitter)
    await vi.advanceTimersByTimeAsync(3000);
    
    // transport should have created a new pc and sent another offer signal
    expect(fakeSignaler.immediateSignals.length).toBe(2);

    // fake disconnect again, delay should be ~4000
    const pc2 = pcInstance!;
    pc2.connectionState = "disconnected";
    pc2.onconnectionstatechange?.();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fakeSignaler.immediateSignals.length).toBe(3);

    transport.dispose();
  });

  it("replaces stale downstream connection when receiving a new offer from the same peer", async () => {
    const fakeSignaler = new FakeSignaler();
    const createdPcs: FakePeerConnection[] = [];

    const factory: P2PTransportFactory = {
      createSignaler: () => fakeSignaler as never,
      createPeerConnection: () => {
        const pc = new FakePeerConnection();
        createdPcs.push(pc);
        return pc as never;
      },
    };

    const callbacks = {
      onStatusChange: vi.fn(),
      onActivePeersChange: vi.fn(),
      onGlobalPeerMapChange: vi.fn(),
      onNpubChange: vi.fn(),
      onAudioStreamChange: vi.fn(),
      onUpstreamTargetChange: vi.fn(),
    };

    const transport = new ListenerTransport(factory, callbacks);
    transport.init();

    // simulate incoming downstream offer
    expect(fakeSignaler.signalHandler).toBeDefined();
    await fakeSignaler.signalHandler!("peer-x", { type: "offer", sdp: "sdp-1" } as SignalPayload);

    expect(createdPcs.length).toBe(1);
    const firstPc = createdPcs[0];
    expect(firstPc.setRemoteDescription).toHaveBeenCalled();
    expect(fakeSignaler.immediateSignals.length).toBe(1); // the answer

    // simulate second offer from the SAME peer (stale PC replacement)
    await fakeSignaler.signalHandler!("peer-x", { type: "offer", sdp: "sdp-2" } as SignalPayload);

    expect(createdPcs.length).toBe(2); // a new pc is created
    expect(firstPc.close).toHaveBeenCalled(); // the old one is closed
    
    const secondPc = createdPcs[1];
    expect(secondPc.setRemoteDescription).toHaveBeenCalled();
    expect(fakeSignaler.immediateSignals.length).toBe(2); // second answer sent

    transport.dispose();
  });
});
