import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip04, type Event } from 'nostr-tools';
import { logger } from '../logger';
import type { SignalPayload, PeerMapEntry, LatentState, CuratorialGraph } from '../types';

// ---------------------------------------------------------------------------
// Relay configuration
// ---------------------------------------------------------------------------

/** All relays to subscribe FROM (read). */
export const NOSTR_RELAYS = [
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://relay.snort.social',
];

/**
 * Relay(s) to publish TO (write).
 * Using a single relay for writes dramatically reduces rate-limit risk.
 * Subscribers read from all relays, so a single write relay is sufficient
 * because relays propagate between each other.
 */
const WRITE_RELAYS = ['wss://nos.lol'];

// Ephemeral event kind used for real-time presence (Topology)
const KIND_PRESENCE = 20000;
// Ephemeral event kind used for WebRTC signaling (offers/answers/candidates)
// Using ephemeral kind instead of NIP-04 DMs (kind 4) because public relays
// silently drop kind-4 events from unauthenticated ephemeral keypairs.
const KIND_SIGNAL = 20001;

// ---------------------------------------------------------------------------
// Safe publish wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps `pool.publish` with error handling so relay rate-limit errors
 * never crash the application as uncaught promise rejections.
 */
function safePublish(pool: SimplePool, relays: string[], event: Event): void {
    try {
        const results = pool.publish(relays, event);
        // pool.publish returns an array of Promises (one per relay).
        // Each can reject independently with rate-limit errors.
        // We must catch every single one.
        for (const p of results) {
            p.catch((err: unknown) => {
                logger.warn('NostrSignaler', 'Relay rejected event', err);
            });
        }
    } catch (err) {
        logger.warn('NostrSignaler', 'Synchronous publish error', err);
    }
}

// ---------------------------------------------------------------------------
// NostrSignaler
// ---------------------------------------------------------------------------

export class NostrSignaler {
    private pool: SimplePool;
    public secretKey: Uint8Array;
    public publicKey: string;
    private subCloser: { close: () => void } | null = null;
    private topoSubCloser: { close: () => void } | null = null;
    private isClosed = false;
    private announceInterval: ReturnType<typeof setInterval> | null = null;

    // In-memory peer map to debounce updates
    private knownPeers: Map<string, PeerMapEntry & { lastSeen: number }> = new Map();

    private outboundQueues: Map<string, SignalPayload[]> = new Map();
    private flushInterval: ReturnType<typeof setInterval> | null = null;

    // Rate-limit tracking
    private lastPublishedTime: number = 0;
    private lastFlushTime: number = 0;

    constructor(providedSecretKey?: Uint8Array) {
        this.pool = new SimplePool();
        this.secretKey = providedSecretKey || generateSecretKey();
        this.publicKey = getPublicKey(this.secretKey);

        // Flush WebRTC candidate queues every 3s.
        // This batches many ICE candidates into a single encrypted DM,
        // dramatically reducing the number of relay writes during negotiation.
        this.flushInterval = setInterval(() => this.flushOutboundQueues(), 3000);
    }

    /**
     * Send a signal immediately (no queue). Used for critical offer/answer signals.
     */
    public async sendSignalImmediate(targetPublicKey: string, signal: SignalPayload): Promise<void> {
        if (this.isClosed) return;

        logger.info('NostrSignaler', `Sending ${signal.type} immediately to ${targetPublicKey.substring(0, 8)}...`);

        try {
            const payloadStr = JSON.stringify(signal);
            const encrypted = await nip04.encrypt(this.secretKey, targetPublicKey, payloadStr);

            const eventTemplate = {
                kind: KIND_SIGNAL,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', targetPublicKey]],
                content: encrypted,
            };

            const event = finalizeEvent(eventTemplate, this.secretKey);
            logger.info('NostrSignaler', `Publishing kind=${KIND_SIGNAL} event to ${NOSTR_RELAYS.length} relays`);
            safePublish(this.pool, NOSTR_RELAYS, event);
            logger.info('NostrSignaler', `Published ${signal.type} to ${targetPublicKey.substring(0, 8)}`);
        } catch (err) {
            logger.error('NostrSignaler', `Failed to send ${signal.type}`, err);
        }
    }

    public async sendSignal(targetPublicKey: string, signal: SignalPayload): Promise<void> {
        if (this.isClosed) return;

        // Push to buffer instead of firing immediately
        let queue = this.outboundQueues.get(targetPublicKey);
        if (!queue) {
            queue = [];
            this.outboundQueues.set(targetPublicKey, queue);
        }
        queue.push(signal);

    }

    private async flushOutboundQueues() {
        if (this.isClosed) return;

        // Global flush rate-limit: never flush faster than every 2 seconds
        const now = Date.now();
        if (now - this.lastFlushTime < 2000) return;
        this.lastFlushTime = now;

        for (const [targetPublicKey, queue] of this.outboundQueues.entries()) {
            if (queue.length === 0) continue;

            // Extract the current queue and reset it immediately to catch new signals
            const signalsToSend = [...queue];
            this.outboundQueues.set(targetPublicKey, []);

            const payload: SignalPayload = signalsToSend.length === 1
                ? signalsToSend[0]
                : { type: "batch", signals: signalsToSend };

            try {
                const payloadStr = JSON.stringify(payload);
                const encrypted = await nip04.encrypt(this.secretKey, targetPublicKey, payloadStr);

                const eventTemplate = {
                    kind: KIND_SIGNAL,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [['p', targetPublicKey]],
                    content: encrypted,
                };

                const event = finalizeEvent(eventTemplate, this.secretKey);
                // Batched candidates go to a single relay to avoid rate-limits.
                // Offers/answers use sendSignalImmediate which hits ALL relays.
                safePublish(this.pool, WRITE_RELAYS, event);
                logger.info('NostrSignaler', `Sent ${payload.type} to ${targetPublicKey.substring(0, 8)}... (${signalsToSend.length} payload(s) grouped)`);
            } catch (err) {
                logger.error('NostrSignaler', 'Failed to send batched signal', err);
            }
        }
    }

    public subscribeToSignals(onSignal: (senderPublicKey: string, signal: SignalPayload) => void): void {
        const sinceTime = Math.floor(Date.now() / 1000); // Only process new signals

        logger.info('NostrSignaler', `Subscribing to kind=${KIND_SIGNAL} for pubkey ${this.publicKey.substring(0, 8)} from ${NOSTR_RELAYS.length} relays`);

        try {
            this.subCloser = this.pool.subscribeMany(
                NOSTR_RELAYS, // Subscribe from ALL relays
                {
                    kinds: [KIND_SIGNAL],
                    '#p': [this.publicKey],
                    since: sinceTime,
                },
                {
                    onevent: async (event: Event) => {
                        logger.info('NostrSignaler', `Received kind=${event.kind} from ${event.pubkey.substring(0, 8)}`);
                        try {
                            const senderPubKey = event.pubkey;
                            const decrypted = await nip04.decrypt(this.secretKey, senderPubKey, event.content);
                            const payload = JSON.parse(decrypted) as SignalPayload;
                            logger.info('NostrSignaler', `Decrypted payload type: ${payload.type}`);

                            // Unwrap batches so handlers only receive
                            // individual signal types (offer/answer/candidate)
                            const dispatch = (sig: SignalPayload) => {
                                if (sig.type === 'batch') {
                                    for (const sub of sig.signals) dispatch(sub);
                                } else {
                                    onSignal(senderPubKey, sig);
                                }
                            };
                            dispatch(payload);
                        } catch (err) {
                            logger.error('NostrSignaler', 'Failed to decrypt/parse incoming signal', err);
                        }
                    },
                    onclose: () => {
                        logger.info('NostrSignaler', 'Signal subscription closed');
                    }
                }
            );
        } catch (err) {
            logger.error('NostrSignaler', 'Failed to subscribe to relays', err);
        }
    }

    // Cached presence state — updated freely without publishing
    private cachedPresence: {
        role: 'root' | 'relay' | 'observer';
        latentState: LatentState;
        connections: number;
        energy: number;
        activeCuratorialGraph?: CuratorialGraph;
    } | null = null;

    /**
     * Update the cached presence data without publishing.
     * The beacon interval will automatically publish the latest state.
     * This is safe to call as frequently as needed (every frame, every state change, etc).
     */
    public updatePresenceData(
        role: 'root' | 'relay' | 'observer',
        latentState: LatentState,
        connections: number = 0,
        energy: number = 100,
        activeCuratorialGraph?: CuratorialGraph,
    ): void {
        this.cachedPresence = { role, latentState, connections, energy, activeCuratorialGraph };
    }

    /**
     * Starts the presence beacon. Publishes once immediately, then
     * every 30 seconds. Only call this ONCE per session.
     */
    public startPresenceBeacon(): void {
        if (this.isClosed || this.announceInterval) return;

        const publishPresence = () => {
            const now = Date.now();
            // Global throttle: never publish presence faster than every 20 seconds
            if (this.isClosed || !this.cachedPresence || now - this.lastPublishedTime < 20000) return;

            try {
                const eventTemplate = {
                    kind: KIND_PRESENCE,
                    created_at: Math.floor(now / 1000),
                    tags: [['t', 'resonance']],
                    content: JSON.stringify(this.cachedPresence),
                };
                const event = finalizeEvent(eventTemplate, this.secretKey);
                safePublish(this.pool, WRITE_RELAYS, event);
                this.lastPublishedTime = now;
            } catch (e) {
                logger.error('NostrSignaler', 'Failed to publish presence beacon', e);
            }
        };

        // One immediate publish, then a relaxed 30-second heartbeat
        publishPresence();
        this.announceInterval = setInterval(publishPresence, 30_000);
    }

    /**
     * Subscribes to the topology field to discover other peers.
     */
    public subscribeToTopology(onTopologyUpdate: (peers: PeerMapEntry[]) => void): void {
        if (this.topoSubCloser) this.topoSubCloser.close();

        // Only look back 5 seconds — ephemeral events shouldn't be stored,
        // but some relays cache them briefly. A short lookback prevents
        // stale root nodes from previous sessions from contaminating the map.
        const sinceTime = Math.floor(Date.now() / 1000) - 5;

        try {
            this.topoSubCloser = this.pool.subscribeMany(
                NOSTR_RELAYS, // Subscribe from ALL relays
                {
                    kinds: [KIND_PRESENCE],
                    '#t': ['resonance'],
                    since: sinceTime,
                },
                {
                    onevent: (event: Event) => {
                        try {
                            // Don't register ourselves in the downstream maps (handled locally)
                            if (event.pubkey === this.publicKey) return;

                            const data = JSON.parse(event.content);

                            // Prevent replay attacks or stale data
                            const existing = this.knownPeers.get(event.pubkey);
                            if (existing && existing.lastSeen >= event.created_at) return;

                            this.knownPeers.set(event.pubkey, {
                                id: event.pubkey,
                                role: data.role || 'observer',
                                latentState: data.latentState,
                                connections: data.connections || 0,
                                energy: data.energy || 100,
                                activeCuratorialGraph: data.activeCuratorialGraph,
                                lastSeen: event.created_at
                            });

                            // Garbage collect stale peers (older than 35 seconds —
                            // just above the 30s beacon interval)
                            const now = Math.floor(Date.now() / 1000);
                            for (const [key, peer] of this.knownPeers.entries()) {
                                if (now - peer.lastSeen > 35) {
                                    this.knownPeers.delete(key);
                                }
                            }

                            // Emit the map as a clean array
                            const cleanMap: PeerMapEntry[] = Array.from(this.knownPeers.values()).map(p => {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const { lastSeen, ...cleanPeer } = p;
                                return cleanPeer as PeerMapEntry;
                            });

                            onTopologyUpdate(cleanMap);

                        } catch (err) {
                            logger.warn('NostrSignaler', 'Failed to parse presence payload', err);
                        }
                    },
                    onclose: () => {
                        logger.info('NostrSignaler', 'Topology subscription closed');
                    },
                    oneose: () => {
                        // End of stored events (historical). Fire map once.
                        const cleanMap: PeerMapEntry[] = Array.from(this.knownPeers.values()).map(p => {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const { lastSeen, ...cleanPeer } = p;
                            return cleanPeer as PeerMapEntry;
                        });
                        onTopologyUpdate(cleanMap);
                    }
                }
            );
        } catch (err) {
            logger.error('NostrSignaler', 'Failed to subscribe to topology', err);
        }
    }

    public close(): void {
        this.isClosed = true;

        if (this.announceInterval) {
            clearInterval(this.announceInterval);
            this.announceInterval = null;
        }

        if (this.subCloser) {
            this.subCloser.close();
            this.subCloser = null;
        }

        if (this.topoSubCloser) {
            this.topoSubCloser.close();
            this.topoSubCloser = null;
        }

        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        this.pool.destroy();
    }
}
