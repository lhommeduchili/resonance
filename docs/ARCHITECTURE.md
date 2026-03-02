# RESONANCE — ARCHITECTURE CONTRACTS
## System Interface & Boundary Specification

Audience: Core Engineers / Senior Coding Agent
Purpose: Freeze architectural boundaries so future evolution (blockchain, scaling, governance)
does NOT require rewriting the runtime system.

---

## 0. PHILOSOPHY

Resonance must evolve without refactoring its core simulation or audio engine.

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
interface ResonanceEvent<T = any> {
  type: string
  timestamp: number
  payload: T
}
```

### Rules

- No subsystem calls another directly.
- Systems subscribe to event types.
- Events are append-only.
- Events must be replayable for debugging.

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

### Network Resiliency Constraints
- Signaling and Peer reconnects MUST implement Exponential Backoff.
- Reconnection attempts MUST jitter to prevent "thundering herd" bottlenecks.
- Dropped packets or transient ICE failures MUST gracefully renegotiate before bubbling visible errors to the UI Contract.

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
  saveEvent(event: ResonanceEvent): Promise<void>
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
- **React State (`useState`, Context):** Strictly for declarative UI elements, text, menus, and metadata rendering.
- **Mutable Refs (`useRef`, `window`):** Exclusively utilized to hold mutable WebRTC connection instances and 60FPS Physics calculation objects. 
- **CRITICAL PERF:** React state MUST NEVER track coordinates inside or be triggered by the `requestAnimationFrame` Canvas loop to prevent catastrophic render bloat.

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

---

## 12. ENGINEERING LAW OF RESONANCE

"Every subsystem must be replaceable without cultural amnesia."

Architecture preserves memory, not implementation.
