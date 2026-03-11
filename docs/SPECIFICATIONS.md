# Specifications: resonance

## Planning Note

Implementation-specific audit and remediation details were first authored in standalone March 2026 planning documents under `docs/`. Their approved runtime outcomes are now reflected in this specification and `docs/ARCHITECTURE.md`, while the standalone docs remain as historical records.

Operational handoff state for the post-refactor phase is tracked in `docs/HANDOFF_2026-03_REFACTOR.md`.

## Overview
resonance is a cryptoeconomic peer-to-peer audio streaming network and self-organized media ecology. 
It replaces central streaming servers with a live simulation field where webcasting stations 
(oscillating nodes) and listeners (particles) interact to form cultural scenes based on laws of 
alignment, attraction, and energy decay.

## Core Architecture & State Layers
- **Tech Stack:** Next.js 14+ (App Router), Electron (Broadcaster Node), TypeScript, Tailwind CSS, 
pnpm.
- **Architectural Constraints:** All subsystem communication MUST respect the exact interface 
boundaries defined in `docs/ARCHITECTURE.md`.
- **Layer A: Real-time ephemeral (WebRTC + simulation)**
  - *Audio Transport Contract:* Adheres to `AudioTransport`. WebRTC mesh + relay topology. Signaling
    via Nostr ephemeral events (kind 20000 presence, kind 20001 WebRTC signaling). Handled precisely
    behind the interface.
  - *Spatial Audio Contract:* All audible output routed exclusively through the Web Audio API graph
    (`MediaStreamSource → StereoPanner → BiquadFilter → GainNode → DynamicsCompressor`). Hidden
    `<audio>` element permanently muted; exists only as a MediaStream keep-alive.
  - *Simulation Engine Contract:* Pure deterministic system `SimulationEngine`. Raw physics handled
    by `usePhysicsEngine`. UI acts ONLY as renderer.
- **Layer B: Persistent off-chain index (DB)**
  - *Storage Contract:* Governed by `PersistenceAdapter`. Handles PostgreSQL, IPFS, and Object 
  Storage without leaking implementation logic to real-time systems.
- **Layer C: Cryptographic anchor (blockchain)**
  - *Blockchain Adapter Contract:* Acts as a plugin (`SettlementAdapter`), not infrastructure. Never 
  knows about real-time topology.

## Event-Driven Architecture
Every system action emits discrete events off-chain: `listener_joined`, `listener_left`, 
`relay_selected`, `curation_support_changed`, `broadcast_started`, `broadcast_ended`.

## The resonance Field & Physics
- The UI is a visual representation of social and cultural physics.
- **Agents:** Participants exist as particles (listeners) and oscillating nodes (broadcasts). 
- **Mechanics:** 
  - *Alignment:* Listeners' tastes gradually align with nearby broadcasts (spin-wave flocking).
  - *Attraction (Gravity):* Popular broadcasts exert pull on listener particles.
  - *Repulsion (Anti-Monopoly):* Prevents single-node dominance by increasing "energy cost" for 
  massive scale, encouraging fragmentation into sub-scenes.
  - *Noise (Exploration):* Stochastic drift that ensures discovery and prevents cultural stagnation.
  - *Energy & Decay:* Broadcasting injects energy ($E_0 e^{-\lambda t}$) into the field. 
- **Identity & Trace:** Identity is cryptographic (wallet-based). Presence leaves a trace, a 
temporary path across cultural space.

## Cryptoeconomics (The Thermodynamics)
- **Flow Energy (Layer 1 - Currency):** Earned by relaying, listening, and broadcasting. It is the 
network's fuel but continuously decays, incentivizing circulation over hoarding/speculation.
- **resonance Marks (Layer 2 - Memory):** Permanent, non-transferable identity-bound proofs of 
participation at key cultural events. Used for governance weight.
- **Stewardship Weight (Layer 3 - Governance):** Influence is derived from long-term participation 
and diversity of contribution, ensuring that "whales" cannot buy control.
- **Protocol Treasury:** A small percentage of circulating Flow Energy converts into a stable 
operational reserve that sustains the real infrastructure (indexers, bootstrap relays). No direct 
user gas fees.

## Functional Roles
- **Listener:** Connects to field, consumes streams, automatically relies packets.
- **Broadcaster:** Publishes live audio, attaches to a Curator's Channel.
- **Relay Node:** Automatic role selected by network health (capacity and adjacency).
- **Curators (DJs, scene organizers):** Act as "cultural routers." Their value is proven via 
Proof-of-Curation (PoC) metrics:
  - *Listener Retention Score:* How long people stay in their channel.
  - *Discovery Impact:* Success of unknown artists after being surfaced by the curator.
  - *Stake Commitment:* Curators stake tokens to launch channels, aligning incentives with quality.

## Development Constraints (Strict)
- The blockchain is a notary, NOT a server. Extensively expensive compute and streaming happens 
off-chain.
- Standard Web3 UX conventions (intrusive transaction popups, buying tokens) must be hidden; 
"Flow Energy" represents systemic fuel, not wealth.
- Delay UI abstraction: The system must communicate its mechanics viscerally within the first 10 
seconds through sound and visual physics. No onboarding screens.
- No feature may access WebRTC directly; abstracted through transport layer.
- **Development Observability:** No feature may utilize raw `console.log`. The `src/lib/logger.ts` 
wrapper is mandatory to monitor the P2P mesh performance cleanly.
- All physics constants centralized. Simulation never reads UI state.
- **Core Web Vitals:** Strict targets. Cumulative Layout Shift (CLS) = 0. Largest Contentful Paint 
(LCP) < 1.2s. Interaction to Next Paint (INP) < 200ms.
- **Bundle Triage:** The initial JS chunk size must be strictly monitored via CI to prevent 
excessive loader bloat. Use dynamic imports (`next/dynamic`) for heavy off-screen components.
- **Accessibility:** Despite being a WebGL/Canvas product, all critical interactions ("Ignite 
Transmission", "Connect Wallet") MUST be backed by invisible semantic DOM overlays for screen 
readers and keyboard navigation.

## March 2026 Implementation Notes

- A region-locale routing foundation is now in place using visible paths: `/{region}/{locale}` and `/{region}/{locale}/broadcast`.
- Initial rollout matrix:
  - `global/en`
  - `global/es-CL`
  - `cl/es-CL`
  - `cl/en`
- English remains the source language for dictionary schema.
- Chilean Spanish (`es-CL`) is the first public localized interface path.
- Branded protocol vocabulary remains glossary-controlled: `Flow Energy`, `resonance Marks`, and `Treasury`.
- Active P2P runtime hooks (`useListener`, `useBroadcaster`) now consume transport services under `src/lib/p2p/transport/` rather than directly instantiating WebRTC/signaling primitives.
- Simulation stepping now runs through a dedicated engine module (`src/lib/simulation/engine.ts`) with explicit `deltaTime` and seeded randomness support; `usePhysicsEngine` acts as an adapter and renderer bridge.
- Runtime fault isolation now includes subsystem boundaries around transport and simulation surfaces in active screens, in addition to the route-level `error.tsx` boundary.
- Semantic accessibility runtime contracts are now represented in code via typed node snapshots (`src/lib/a11y/contracts.ts`) and a dedicated overlay/announcer layer (`src/components/a11y/*`).
- Deterministic simulation safeguards now include invalid-delta no-op behavior and frame-rate invariance regression tests (`src/lib/simulation/__tests__/engine.test.ts`).
- Logger-only observability is now enforced by lint policy (`no-console`) with `src/lib/logger.ts` as the approved console boundary.
- A11y overlays now include coordinate-aware semantic node controls projected from simulation space into viewport space.
- Localized live narration now includes proximity, connection negotiation, tuned state, and transmission lifecycle messaging for `en` and `es-CL`.
- Broadcaster initiation now uses a staged ignition sequence (priming/stabilizing) before live state, preserving semantic action controls.
- CI now enforces architecture guard tests for event envelope behavior, deterministic simulation paths, and a11y projection contracts.
- Runtime latent-state exchange between simulation and listener transport now uses a typed in-process runtime channel rather than global `window` custom events.
- Transport lifecycle guard tests now cover listener and broadcaster service baseline behaviors in `src/lib/p2p/transport/__tests__/`.
- Live broadcaster sessions now require a curatorial channel binding prior to ignition, and channel metadata is propagated through peer topology for listener discovery/a11y surfaces.
- Runtime attribution handoff now exists as a client bridge plus server-oriented event processor (`src/lib/poc/client.ts`, `src/lib/poc/serverEvents.ts`) designed to keep Layer A decoupled from direct DB access.
- A deployment-ready ingestion worker is available at `scripts/poc-event-server.ts` (`pnpm poc:events`), receiving `/events` payloads from `NEXT_PUBLIC_POC_EVENT_ENDPOINT` and forwarding them into PoC handlers.
