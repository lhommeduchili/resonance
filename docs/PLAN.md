# resonance — Road to MVP (Plan)

## 1. System Architecture (MVP Target)
- **Frontend:** Next.js App Router, Canvas Simulation Field, WebAudio spatial engine, WebRTC 
transport.
- **Broadcaster Node:** Electron-based desktop application for root streaming, local key management, 
and direct hardware access.
- **Coordination Layer:** Decentralized Nostr public relays for WebRTC signaling (kind 20001
  ephemeral events, NIP-04 encrypted), topology presence (kind 20000), and peer discovery.
  Session graph tracker, Energy accounting engine.
- **Storage:** Postgres (metadata + graphs), Object storage (archives), Optional IPFS adapter.
- **Blockchain (Phase-delayed):** Identity registry, Settlement contract, Treasury contract.

## 2. Role Model Implementation
- [x] **Listener:** connects to field, consumes streams, optionally relays packets, produces support 
signals.
- [x] **Broadcaster:** publishes live audio, attaches to a Channel, signs session metadata.
- [ ] **Curator:** owns a Curatorial Graph, selects broadcasters, accumulates Proof-of-Curation 
metrics.
- [x] **Relay Node:** automatic role, selected by network health based on latent spatial distance 
and bandwidth.

## 3. Development Phases

### PHASE 1 — Stabilize Core Runtime
**Goals:** deterministic physics loop, stable WebRTC relay switching, telemetry normalization.
**Deliverable:** Stable 100-node simulated test.
- [x] Next.js framework initialized with Tailwind v4, TS, App Router, pnpm.
- [x] Isolate physics worker thread (`usePhysicsEngine`, `useAnimationFrame`) for 60FPS simulation 
stability.
- [x] Implement deterministic physics loop (spin-wave flocking, cultural gravity, anti-monopoly 
repulsion).
- [x] Abstract transport layer (P2P WebRTC mesh + Nostr coordination).
- [x] Stable WebRTC relay switching (BitTorrent-style routing based on capacity and latent spatial 
distance).
- [x] Telemetry normalization (network pipeline stress dictates visual canvas distortion).
- [x] Introduce dedicated event bus architecture.
- [x] Refactor and decompose physics/transport core engines for enhanced performance and 
readability.
- [x] Nostr-based signaling: ephemeral kind 20000 (presence) and kind 20001 (WebRTC signaling)
  with NIP-04 encryption, batch signal unwrapping, and immediate offer/answer sends.
- [x] Spatial audio pipeline: dual-mode (ambient/active) with Web Audio API graph as sole output.
  Hidden `<audio>` element permanently muted as stream keep-alive.
- [x] Instant tune/untune lifecycle: status toggle without WebRTC renegotiation.
- [x] Broadcaster stale PeerConnection reset on re-offer from existing peer.
- [x] Infrastructure: Implement E2E Testing (Playwright) for the P2P connection loops.
- [x] Infrastructure: Setup GitHub Actions CI/CD pipeline for automated type checking and static 
analysis.

### PHASE 2 — Curatorial Graph Engine
**Goals:** persistent curator identity, channel abstraction, attribution tracking.
**Deliverable:** Curators visible as first-class entities.
- [x] Architect Proof-of-Curation (PoC) metrics (Session Retention, Discovery Impact).
- [x] Mock Curatorial Graphs in coordination layer.
- [x] DB schema for graph edges (Postgres).
- [x] Session attribution scoring pipeline.
- [x] Retention metrics pipeline.

### PHASE 3 — Archive System (“Ghost Layer”)
**Goals:** replayable broadcasts, temporal memory.
**Deliverable:** Past broadcasts appear in field.
- [x] Chunk recording pipeline.
- [x] Metadata snapshots.
- [x] Replay loader (Contract interface defined).

### PHASE 4 — Identity Layer
**Goals:** silent wallet creation, cryptographic signing.
**Deliverable:** Users possess portable identity.
- [x] Wallet abstraction (silent key generation via Nostr).
- [ ] Session signature verification.
- [ ] Identity persistence.

### PHASE 5 — Energy Accounting
**Goals:** finalize off-chain economy.
**Deliverable:** Full economic simulation without tokens.
- [x] Energy decay scheduler (Flow Energy thermodynamic math $E_0 e^{-\lambda t}$).
- [ ] Curator reward calculation.
- [ ] Relay contribution scoring.
- [ ] Engineer the periodic energy to on-chain settlement pipeline.

## 6. Success Metrics (MVP)
**Technical:**
- <150ms audio latency
- 60FPS simulation stability
- >80% relay success rate

**Behavioral:**
- listeners discover new broadcasts
- curators create persistent channels
- sessions organically cluster
