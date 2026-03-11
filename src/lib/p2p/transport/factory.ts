import { ICE_SERVERS } from "@/lib/types";
import { NostrSignaler } from "@/lib/p2p/nostrSignal";

export interface P2PTransportFactory {
  createSignaler(secretKey?: Uint8Array): NostrSignaler;
  createPeerConnection(): RTCPeerConnection;
}

export const browserP2PTransportFactory: P2PTransportFactory = {
  createSignaler(secretKey?: Uint8Array) {
    return new NostrSignaler(secretKey);
  },
  createPeerConnection() {
    return new RTCPeerConnection({ iceServers: ICE_SERVERS });
  },
};
