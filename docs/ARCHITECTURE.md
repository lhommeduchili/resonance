# RESONANCE — ARCHITECTURE CONTRACTS
## System Interface & Boundary Specification

Planning note: March 2026 remediation decisions have now been merged into this canonical document. The standalone files (`docs/AUDIT_2026-03.md`, `docs/REFACTOR_PLAN.md`, `docs/RUNTIME_CONTRACTS.md`, `docs/A11Y_LOCALIZATION.md`, `docs/ENGINEERING_STANDARDS.md`, and `docs/ISSUE_ROADMAP.md`) remain as historical audit records.

Audience: Core Engineers / Senior Coding Agent
Purpose: Freeze architectural boundaries so future evolution (blockchain, scaling, governance) does 
NOT require rewriting the runtime system.

---

## 0. PHILOSOPHY

resonance must evolve without refactoring its core simulation or audio engine.

Therefore:

- Real‑time systems MUST NOT depend on persistence.
- Persistence MUST NOT depend on blockchain.
- Blockchain MUST NEVER know about real‑time topology.

All communication occurs through **contracts (interfaces)**.

---

## 1. GLOBAL EVENT BUS CONTRACT

All subsystems communicate through an event layer.

### Interface

```ts
interface resonanceEvent<T = any> {
  type: string
  timestamp: number
  source: "listener" | "broadcaster" | "simulation" | "transport" | "ui" | "system"
  payload: T
}
```

### Rules

- No subsystem calls another directly.
- Systems subscribe to event types.
- Events are append-only.
- Events must be replayable for debugging.
- Runtime events should include envelope metadata (`type`, `timestamp`, `source`, `payload`) and keep bounded history for diagnostics.
- Client runtime MAY forward selected event envelopes to a server-side attribution processor, but MUST NOT import persistence adapters directly.
- Runtime subsystem exchange should use typed channels/contracts; global `window` custom-event bridges are disallowed for core simulation/transport synchronization.

### Core Events

listener.joined
listener.left
broadcast.started
broadcast.ended
relay.assigned
curation.supportChanged
energy.updated

---

## 2. TRANSPORT CONTRACT (WebRTC Isolation)

The Simulation Engine MUST NEVER reference WebRTC APIs.

### Interface

```ts
interface AudioTransport {
  publish(stream: MediaStream): Promise<void>
  subscribe(peerId: string): Promise<MediaStream>
  disconnect(peerId: string): void
  getStats(): TransportStats
}
```

### Guarantee

Transport implementation may change:
- Mesh P2P
- SFU
- Edge relays
- Future protocols

Simulation remains unchanged.

### Signaling Layer (Nostr)

WebRTC signaling uses **Nostr ephemeral events** via public relays (no central server):
- **kind 20000:** presence beacons (topology discovery, peer map).
- **kind 20001:** WebRTC signaling (offers, answers, ICE candidates), NIP-04 encrypted payloads.
- **Batch unwrapping:** ICE candidates are batched for efficiency. The subscription layer recursively
  unwraps `batch` signals before dispatching to handlers.
- **Immediate sends:** critical offer/answer signals bypass the batch queue and publish immediately
  to all relays.

### ICE Configuration
- **Development:** STUN-only (Google STUN servers). Host candidates suffice for localhost.
- **Production:** add a paid TURN provider (e.g. Metered, Twilio, Xirsys) for NAT traversal.
- Keep total ICE servers under 5 (Firefox performance constraint).

### Network Resiliency Constraints
- Signaling and Peer reconnects MUST implement Exponential Backoff.
- Reconnection attempts MUST jitter to prevent "thundering herd" bottlenecks.
- Dropped packets or transient ICE failures MUST gracefully renegotiate before bubbling visible 
errors to the UI Contract.
- The broadcaster MUST reset stale PeerConnections when receiving a new offer from an existing peer
  (handles listener page refresh / reconnect).
- Each live broadcaster session MUST bind to exactly one curatorial channel identity; channel metadata
  is propagated in presence payloads and may only change by ending the current session and starting a
  new one.

---

## 2b. SPATIAL AUDIO CONTRACT

All audible output is routed exclusively through the **Web Audio API spatial graph**.

The hidden `<audio>` element exists solely as a MediaStream keep-alive and MUST remain permanently
muted.

### Audio Graph

```
MediaStreamSource → StereoPanner → BiquadFilter (lowpass) → GainNode → DynamicsCompressor → destination
```

### Dual-Mode Processing

| Mode | Volume | Pan | Lowpass | Effect |
|---|---|---|---|---|
| **Active** (LISTENING) | 1.0 | centered (0) | Nyquist (transparent) | pristine, full-spectrum |
| **Ambient** (AMBIENT) | 0.05–0.4 (distance) | spatial | 150–800 Hz (distance) | muffled, directional |

### Tune/Untune Lifecycle
- **Tune in** (click halo): instant status toggle to LISTENING; no WebRTC renegotiation.
- **Untune** (click again): instant status toggle to AMBIENT; connection stays alive.
- **Reconnect** (after disconnect): status set to CONNECTING; ontrack promotes to LISTENING.

---

## 3. SIMULATION ENGINE CONTRACT

Physics operates as a deterministic pure system.

### Interface

```ts
interface SimulationEngine {
  step(deltaTime: number): SimulationState
  injectInteraction(event: InteractionEvent): void
}
```

### Constraints

- No DOM access
- No network calls
- No database reads
- Deterministic from inputs

This allows replay and scientific reproducibility.

---

## 4. CURATORIAL GRAPH CONTRACT

Curators exist as semantic entities independent from sessions.

### Interface

```ts
interface CuratorialGraph {
  curatorId: string
  channels: Channel[]
  attributionScore(sessionId: string): number
}
```

### Responsibilities

- Track discovery lineage
- Compute Proof‑of‑Curation
- Persist cultural memory

Broadcasters animate graphs but do not own them.

---

## 5. ENERGY ENGINE CONTRACT

Economic simulation runs fully off‑chain.

### Interface

```ts
interface EnergyEngine {
  registerSupport(listenerId: string, channelId: string, rate: number): void
  decay(timeDelta: number): void
  snapshot(): EnergyState
}
```

### Rules

- Continuous decay model
- No tokens required
- Periodic snapshot exportable

---

## 6. STORAGE CONTRACT

Persistence layer abstraction.

```ts
interface PersistenceAdapter {
  saveEvent(event: resonanceEvent): Promise<void>
  loadSession(sessionId: string): Promise<SessionData>
  storeArchive(chunk: ArrayBuffer): Promise<string>
}
```

Implementations:
- PostgreSQL
- IPFS
- Object storage
- Future decentralized DB

---

## 7. IDENTITY CONTRACT

Identity must be portable and silent.

```ts
interface IdentityProvider {
  getUserId(): string
  sign(data: Uint8Array): Promise<Signature>
  verify(signature: Signature): boolean
}
```

Possible backends:
- local keypair
- wallet
- hardware key
- social recovery

Runtime never cares which.

---

## 8. BLOCKCHAIN ADAPTER CONTRACT

Blockchain is a PLUGIN — not infrastructure.

```ts
interface SettlementAdapter {
  anchorSnapshot(snapshot: EnergyState): Promise<string>
  verifyAnchor(hash: string): Promise<boolean>
}
```

Chain can change without affecting system.

---

## 9. UI CONTRACT

UI is a renderer only.

UI MAY:
- display simulation state
- emit interaction events

UI MAY NOT:
- modify simulation directly
- access persistence

### Frontend Folder Structure (Next.js Strict)
- `/src/app`: Root layouts, Server Components, and Routing exclusively.
- `/src/components`: Pure presentational React entities.
- `/src/hooks`: Reusable client logic (`useBroadcaster`, `usePhysicsEngine`).
- `/src/lib`: Stateless domains, math formulas, contracts, Server Actions.

### State Management Paradigm
- **React State (`useState`, Context):** Strictly for declarative UI elements, text, menus, and 
metadata rendering.
- **Mutable Refs (`useRef`, `window`):** Exclusively utilized to hold mutable WebRTC connection 
instances and 60FPS Physics calculation objects. 
- **CRITICAL PERF:** React state MUST NEVER track coordinates inside or be triggered by the `requestAnimationFrame` Canvas loop to prevent catastrophic render bloat.
- **Observability Constraint:** The use of raw `console.log` is strictly prohibited in production 
code. All telemetry and debugging must be routed through the dedicated `logger.ts` wrapper.

### Accessibility And Localization Runtime Contract
- Semantic overlays MUST mirror active broadcast Nodes with focusable controls that map to field actions.
- Overlay controls SHOULD be projected from simulation/world coordinates into viewport space.
- `aria-live` narration MUST be localized and event-driven (join/leave, broadcast lifecycle, tune/proximity states).
- `region` is deployment/regulatory context. `locale` is language/formatting context.
- English is the source schema. `es-CL` is a first-class public locale.

---

## 10. SCALING GUARANTEE

If all contracts are respected:

You can replace simultaneously:
- WebRTC → SFU
- Postgres → Distributed DB
- Off‑chain economy → On‑chain settlement

WITHOUT touching:
- simulation engine
- curator logic
- user experience layer

---

## 11. FAILURE ISOLATION MODEL

Subsystem crash must not propagate.

Example:
Transport failure → audio drops
Simulation continues
Energy accounting continues

**Frontend Isolation:**
- All Next.js routes must utilize `error.tsx` boundaries to catch render failures.
- WebGL Context losses or WebRTC fatal errors MUST be caught by custom React Error Boundaries and 
must not crash the broader DOM tree.

---

## 12. ENGINEERING LAW OF RESONANCE

"Every subsystem must be replaceable without cultural amnesia."

Architecture preserves memory, not implementation.
