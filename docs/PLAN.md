# Resonance - Roadmap & Plan

## Current Status: Phase 1 - Prototype (Active)

### Accomplished
- Next.js framework initialized with Tailwind v4, TS, App Router, and pnpm.
- Initial theoretical layout and styling conventions seeded.

### Active Goals
- Implement the live audio P2P transport layer (WebRTC mesh and libp2p basics).
- Develop the minimal WebRTC broadcast client (audio ingestion without traditional UI flows).
- Construct the primary Simulation Field using Canvas/WebGL to render the dark space, nodes, and particles.
- Link spatial audio decoding to cursor proximity relative to active nodes.

## Future Phases

### Phase 2: Cultural Ledger & Identity
- Integrate silent wallet-auth.
- Implement broadcast signing and participant cryptographic proofs.
- Develop archival storage pipelines for "Ghosts of past broadcasts" (IPFS-esque).

### Phase 3: Thermoeconomics (Energy)
- Code the Flow Energy simulation logic ($E_0 e^{-\lambda t}$).
- Setup the off-chain live micro-support allocation algorithm (`support_rate = energy / minute`).
- Engineer the periodic energy to on-chain settlement pipeline.

### Phase 4: Governance
- Issuance of Resonance Marks for historical memory and status tracking.
- Transition Protocol Treasury stewardship to DAO weighting parameters based on the Resonance math parameters (`governance_weight = time_present × scenes_supported × relay_contribution`).
