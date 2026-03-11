import { beforeEach, describe, expect, it, vi } from "vitest";
import { BroadcasterTransport } from "@/lib/p2p/transport/broadcasterTransport";
import type { P2PTransportFactory } from "@/lib/p2p/transport/factory";
import type { CuratorialGraph, SignalPayload } from "@/lib/types";

vi.mock("@/lib/audio/broadcastLimiter", () => ({
  createLimitedStream: (stream: MediaStream) => ({
    outputStream: stream,
    destroy: vi.fn(),
  }),
}));

class FakeSignaler {
  public publicKey = "npub_test_broadcast";
  public signalHandler?: (sender: string, signal: SignalPayload) => Promise<void>;
  public immediateSignals: Array<{ target: string; signal: SignalPayload }> = [];

  subscribeToSignals(handler: (senderPubKey: string, signal: SignalPayload) => Promise<void>) {
    this.signalHandler = handler;
  }
  subscribeToTopology() {}
  updatePresenceData() {}
  startPresenceBeacon() {}
  close() {}
  sendSignalImmediate(target: string, signal: SignalPayload) {
    this.immediateSignals.push({ target, signal });
  }
  sendSignal() {}
}

class FakePeerConnection {
  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState: RTCPeerConnectionState = "new";
  public remoteDescription: RTCSessionDescriptionInit | null = null;
  public mockReplaceTrack = vi.fn();
  
  createAnswer = vi.fn(async () => ({ type: "answer" as const, sdp: "fake-answer" }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = desc;
  });
  
  getSenders = vi.fn(() => [{ track: { kind: "audio" }, replaceTrack: this.mockReplaceTrack }]);
  addTrack = vi.fn();
  close = vi.fn();
}

describe("BroadcasterTransport", () => {
  let getUserMediaMock: unknown;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    const fakeStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ kind: "audio", stop: vi.fn() }],
    } as unknown as MediaStream;

    getUserMediaMock = vi.fn(async () => fakeStream);

    Object.defineProperty(globalThis, "navigator", {
      value: {
        mediaDevices: {
          getUserMedia: getUserMediaMock,
        },
      },
      configurable: true,
    });
  });

  it("enters live status and exposes broadcaster npub on start", async () => {
    const graph: CuratorialGraph = {
      id: "graph-test",
      curatorWallet: "0x123",
      name: "Andes Nocturne",
      tags: [],
      rules: [],
      poc: { discoveryImpact: 0, retentionScore: 0 },
    };

    const callbacks = {
      onStatusChange: vi.fn(),
      onErrorChange: vi.fn(),
      onListenersChange: vi.fn(),
      onGlobalPeerMapChange: vi.fn(),
      onNpubChange: vi.fn(),
      onActiveStreamChange: vi.fn(),
    };

    const factory: P2PTransportFactory = {
      createSignaler: () => new FakeSignaler() as never,
      createPeerConnection: () => new FakePeerConnection() as never,
    };

    const transport = new BroadcasterTransport(factory, callbacks, "VOICE");
    await transport.startBroadcast({ profile: "VOICE", graph });

    expect(callbacks.onStatusChange).toHaveBeenCalledWith("CONNECTING");
    expect(callbacks.onStatusChange).toHaveBeenCalledWith("LIVE");
    expect(callbacks.onNpubChange).toHaveBeenCalledWith("npub_test_broadcast");

    transport.stopBroadcast();
  });

  it("replaces stale offer connection replacing previous active pc", async () => {
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

    const transport = new BroadcasterTransport(factory, {
      onStatusChange: vi.fn(),
      onErrorChange: vi.fn(),
      onListenersChange: vi.fn(),
      onGlobalPeerMapChange: vi.fn(),
      onNpubChange: vi.fn(),
      onActiveStreamChange: vi.fn(),
    }, "VOICE");

    await transport.startBroadcast({ profile: "VOICE", graph: {} as unknown as CuratorialGraph });
    
    // Simulate incoming offer
    expect(fakeSignaler.signalHandler).toBeDefined();
    await fakeSignaler.signalHandler!("peer-y", { type: "offer", sdp: "sdp-old" } as SignalPayload);
    
    expect(createdPcs.length).toBe(1);
    
    // Simulate same peer sending new offer (churn / restart)
    await fakeSignaler.signalHandler!("peer-y", { type: "offer", sdp: "sdp-new" } as SignalPayload);
    
    expect(createdPcs.length).toBe(2);
    expect(createdPcs[0].close).toHaveBeenCalled(); // The first connection must be closed without race conditions
    expect(createdPcs[1].setRemoteDescription).toHaveBeenCalled(); // The new connection handles the offer

    transport.stopBroadcast();
  });

  it("handles profile/device swaps without losing peer connections or causing stream ref races", async () => {
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

    const transport = new BroadcasterTransport(factory, {
      onStatusChange: vi.fn(),
      onErrorChange: vi.fn(),
      onListenersChange: vi.fn(),
      onGlobalPeerMapChange: vi.fn(),
      onNpubChange: vi.fn(),
      onActiveStreamChange: vi.fn(),
    }, "VOICE");

    await transport.startBroadcast({ profile: "VOICE", graph: {} as unknown as CuratorialGraph });
    
    // Have one PC open
    await fakeSignaler.signalHandler!("peer-z", { type: "offer", sdp: "sdp-1" } as SignalPayload);
    const initialPc = createdPcs[0];
    
    // Trigger device swap
    await transport.changeDevice("fake-device-123");
    
    // Get sender should be called to replace track
    expect(initialPc.getSenders).toHaveBeenCalled();
    expect(initialPc.mockReplaceTrack).toHaveBeenCalled();
    
    // Now trigger new connection, it should use the updated stream tracked globally via limiter closure
    await fakeSignaler.signalHandler!("peer-w", { type: "offer", sdp: "sdp-2" } as SignalPayload);
    
    const secondPc = createdPcs[1];
    expect(secondPc.addTrack).toHaveBeenCalled();

    transport.stopBroadcast();
  });
});
