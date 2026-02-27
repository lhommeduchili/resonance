# Specifications: Resonance

## Overview
Resonance is a cryptoeconomic peer-to-peer radio network and self-organized media ecology. It replaces central streaming servers with a live simulation field where stations (oscillating nodes) and listeners (particles) interact to form cultural scenes based on laws of alignment, attraction, and energy decay.

## Core Architecture
- **Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, pnpm.
- **Layer 1: Live Audio Transport (P2P)**: WebRTC mesh + relay topology, libp2p. Listeners automatically become relay nodes, strengthening the broadcast swarm (BitTorrent-style). Adaptive bitrate Opus encoding.
  - *Audio Processing:* Governed by isolated hooks (`useSpatialAudio`) leveraging the Web Audio API for environmental filtering.
- **Layer 2: Identity & Metadata**: Built on cryptographic identity (wallet public keys). Participation generates a portable reputation without traditional accounts.
- **Layer 3: Archival Layer**: Segments are stored via distributed storage (IPFS-like). Archivists earn incentives for hosting culturally significant broadcasts.
- **Layer 4: Coordination Layer (Blockchain)**: Blockchain acts as a notary, not a server. Records only rare, meaningful events: Broadcast Birth Certificates, Identity Anchoring, Periodic Energy Settlement, and Governance Votes.
- **Simulation Field (State & UI Layer)**: Handled client-side via high-performance Canvas.
  - *Rendering Pipeline:* Strongly modularized. Raw physics and node orchestration are handled exclusively by `usePhysicsEngine`, while rendering loops are managed by `useAnimationFrame` to prevent React closure staleness and ensure 60FPS.

## The Resonance Field & Physics
- The UI is a visual representation of social and cultural physics.
- **Agents:** Participants exist as particles (listeners) and oscillating nodes (broadcasts). 
- **Mechanics:** 
  - *Alignment:* Listeners' tastes gradually align with nearby broadcasts.
  - *Attraction (Gravity):* Popular broadcasts exert pull on listener particles.
  - *Repulsion (Anti-Monopoly):* Prevents single-node dominance by increasing "energy cost" for massive scale, encouraging fragmentation into sub-scenes.
  - *Noise (Exploration):* Stochastic drift that ensures discovery and prevents cultural stagnation.
  - *Energy & Decay:* Broadcasting injects energy ($E_0 e^{-\lambda t}$) into the field. 
- **Identity & Trace:** Identity is cryptographic (wallet-based). Presence leaves a trace, a temporary path across cultural space.

## Cryptoeconomics (The Thermodynamics)
- **Flow Energy (Layer 1 - Currency):** Earned by relaying, listening, and broadcasting. It is the network's fuel but continuously decays, incentivizing circulation over hoarding/speculation.
- **Resonance Marks (Layer 2 - Memory):** Permanent, non-transferable identity-bound proofs of participation at key cultural events. Used for governance weight.
- **Stewardship Weight (Layer 3 - Governance):** Influence is derived from long-term participation and diversity of contribution, ensuring that "whales" cannot buy control.
- **Protocol Treasury:** A small percentage of circulating Flow Energy converts into a stable operational reserve that sustains the real infrastructure (indexers, bootstrap relays). No direct user gas fees.

## Functional Roles
- **Curators (DJs, scene organizers):** Act as "cultural routers." Their value is proven via Proof-of-Curation (PoC) metrics:
  - *Listener Retention Score:* How long people stay in their channel.
  - *Discovery Impact:* Success of unknown artists after being surfaced by the curator.
  - *Stake Commitment:* Curators stake tokens to launch channels, aligning incentives with quality.


## Development Constraints (Strict)
- The blockchain is a notary, NOT a server. Extensively expensive compute and streaming happens off-chain.
- Standard Web3 UX conventions (intrusive transaction popups, buying tokens) must be hidden; "Flow Energy" represents systemic fuel, not wealth.
- Delay UI abstraction: The system must communicate its mechanics viscerally within the first 10 seconds through sound and visual physics. No onboarding screens.
