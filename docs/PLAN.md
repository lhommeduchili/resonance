# Resonance - Roadmap & Plan

## Current Status: Phase 1 - Prototype (Active)

### Accomplished
- Next.js framework initialized with Tailwind v4, TS, App Router, and pnpm.
- Initial theoretical layout and styling conventions seeded.
- Implement the live audio P2P transport layer (WebRTC mesh and basic Socket coordination).
- Construct the primary Simulation Field using Canvas, heavily modularized into `usePhysicsEngine` and `useAnimationFrame` to maintain 60FPS.
- **Physics Engine:** Implemented Attanasi et al. spin-wave flocking, cultural gravity, anti-monopoly repulsion, and user override interactions.
- **Audio Coupling:** Spatial audio decoding, panning, and low-pass filtering are dynamically driven by the true latent distances calculated by the physics simulation.
- **UX Polish:** Click-to-connect/disconnect within broadcast halo zones. Gravity gated to self-agent only when actively tuned in. Ambient audio stream survives disconnect/reconnect cycles. Broadcast terminal exposes pre-ignition telemetry waveform.
- **Code Quality Audit:** Shared types (`src/lib/types.ts`) and physics constants (`src/lib/physicsConstants.ts`) extracted. Eliminated all `any` types across hooks. Fixed leaked `setInterval` in broadcaster. Typed `interactionTimeout` ref. Cached canvas 2D context. Removed redundant `AudioContext.suspend()`.

### Phase 2: User Experience & Core MVP Setup
- **WebRTC Refinement:** Fine-tune the WebRTC relay logic (listeners passing packets to other listeners/BitTorrent-style scaling).
- **Network Telemetry:** Implement dynamic network metrics (e.g., true data transfer rates) feeding back into the simulation physics.
- Code the Flow Energy simulation logic ($E_0 e^{-\lambda t}$) and live off-chain micro-support algorithms (`support_rate = energy / minute`) as experiential metrics.
- Implement Proof-of-Curation (PoC) metrics for Curators (e.g., Listener Retention Score, Discovery Impact) to align channel creation with quality before tokens are involved.
- Develop archival storage pipelines for "Ghosts of past broadcasts" (IPFS-esque).

### Phase 3: Cryptographic Identity & Metadata
- Integrate silent wallet-auth.
- Implement broadcast signing and participant cryptographic proofs.
- Setup prerequisites for on-chain state anchoring.

### Phase 4: Blockchain Coordination & Governance
- Engineer the periodic energy to on-chain settlement pipeline.
- Issuance of Resonance Marks for historical memory and status tracking.
- Transition Protocol Treasury stewardship to DAO weighting parameters based on the Resonance math parameters (`governance_weight = time_present × scenes_supported × relay_contribution`).
- Integrate Curator Stake Commitments to launch active channels.
