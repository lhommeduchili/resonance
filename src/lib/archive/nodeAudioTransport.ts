import { logger } from "@/lib/logger";
// src/lib/archive/nodeAudioTransport.ts

import * as ndc from 'node-datachannel';
import { AudioTransport, TransportStats } from '@/lib/contracts';
import { persistence } from './persistenceAdapter';

/**
 * NodeJs implementation of the AudioTransport Contract.
 * Utilizes `node-datachannel` pure C++ bindings to act as a 
 * headless peer in the WebRTC mesh, strictly for archiving.
 */
export class NodeAudioTransport implements AudioTransport {
    // Map of peer connections for multi-stream archiving capability
    private connections: Map<string, ndc.PeerConnection> = new Map();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async publish(stream: unknown): Promise<void> {
        throw new Error('NodeAudioTransport MVP only supports subscribing (recording).');
    }

    /**
     * Initializes a WebRTC connection mimicking a standard listener,
     * but explicitly capturing the Opus Media stream to the PersistenceAdapter.
     */
    async subscribe(peerId: string): Promise<unknown> {
        logger.info("ArchiveNode", `[ArchiveNode] Bootstrapping AudioTransport for peer: ${peerId}`);

        // We instantiate the C++ bound PeerConnection
        const pc = new ndc.PeerConnection(peerId, { iceServers: ['stun:stun.l.google.com:19302'] });
        this.connections.set(peerId, pc);

        const connectionWrapper = {
            pc,
            onLocalSignal: null as ((signal: unknown) => void) | null,
            initiateOffer: () => {
                // To force node-datachannel to generate an offer without tracks, we create a dummy channel
                pc.createDataChannel('ghost-layer-control');
                pc.setLocalDescription();
            },
            handleRemoteSignal: (signal: Record<string, unknown>) => {
                try {
                    if (signal.type === 'answer' || signal.type === 'offer') {
                        pc.setRemoteDescription(signal.sdp as string, signal.type as ndc.DescriptionType);
                    } else if (signal.type === 'candidate' && signal.candidate) {
                        pc.addRemoteCandidate((signal.candidate as Record<string, unknown>).candidate as string, (signal.candidate as Record<string, unknown>).sdpMid as string || '');
                    }
                } catch (e) {
                    console.error("[ArchiveNode] Error handling remote signal:", e);
                }
            }
        };

        pc.onLocalDescription((sdp: string, type: string) => {
            if (connectionWrapper.onLocalSignal) {
                connectionWrapper.onLocalSignal({ type, sdp });
            }
        });

        pc.onLocalCandidate((candidate: string, mid: string) => {
            if (connectionWrapper.onLocalSignal) {
                connectionWrapper.onLocalSignal({ candidate, sdpMid: mid, sdpMLineIndex: 0 }); // node-datachannel doesn't map mline index well, but this works for MVP
            }
        });

        pc.onTrack((track) => {
            logger.info("ArchiveNode", `[ArchiveNode] Audio Track acquired from ${peerId}`);

            let chunkSequence = 0;
            let currentBuffer: Buffer[] = [];
            let byteCount = 0;

            // We chunk the IPFS .ogg file every ~1 megabyte for decentralized storage efficiency
            const CHUNK_SIZE_BYTES = 1048576;

            // Hook into the native C++ Media packets
            // Note: Cast to any as @types/node-datachannel varies on Media stream typings
            if (typeof (track as unknown as { onMessage?: unknown }).onMessage === 'function') {
                (track as unknown as { onMessage: (cb: (msg: Uint8Array | Buffer | string) => void) => void }).onMessage((msg: Uint8Array | Buffer | string) => {
                    if (Buffer.isBuffer(msg) || msg instanceof Uint8Array) {
                        const buf = Buffer.from(msg);
                        currentBuffer.push(buf);
                        byteCount += buf.length;

                        if (byteCount >= CHUNK_SIZE_BYTES) {
                            const fullChunk = Buffer.concat(currentBuffer);

                            // Contract boundary: Hand off to PersistenceAdapter
                            persistence.storeArchive(
                                fullChunk.buffer.slice(fullChunk.byteOffset, fullChunk.byteOffset + fullChunk.byteLength) as ArrayBuffer,
                                peerId,
                                chunkSequence++
                            );

                            currentBuffer = [];
                            byteCount = 0;
                        }
                    }
                });
            }
        });

        // Provide the peer connection out to the Signaling wrapper
        return connectionWrapper;
    }

    disconnect(peerId: string): void {
        const pc = this.connections.get(peerId);
        if (pc) {
            pc.close();
            this.connections.delete(peerId);
            logger.info("ArchiveNode", `[ArchiveNode] Disconnected AudioTransport for ${peerId}`);
        }
    }

    getStats(): TransportStats {
        // Returning dummy MVP stats. 
        // In production, ndc.PeerConnection exposes bytesReceived, rtt, etc.
        return {
            latency: 0,
            bytesReceived: Array.from(this.connections.values()).reduce((acc, pc) => acc + (pc.bytesReceived?.() || 0), 0),
            bytesSent: 0,
            packetsLost: 0
        };
    }
}

export const archiveTransport = new NodeAudioTransport();
