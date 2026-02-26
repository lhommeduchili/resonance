# Specifications: Resonance

## Overview
Resonance is a cryptoeconomic peer-to-peer radio network and self-organized media ecology. It replaces central streaming servers with a live simulation field where stations (oscillating nodes) and listeners (particles) interact to form cultural scenes based on laws of alignment, attraction, and energy decay.

## Core Architecture
- **Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, pnpm.
- **P2P Transport (Live Audio Layer):** WebRTC mesh + relay topology, libp2p. Listeners automatically become relay nodes.
- **Simulation Field (State & UI Layer):** Handled client-side via high-performance Canvas/WebGL. No menus; UI is a literal visualization of the network topology.
- **Coordination Layer / Blockchain:** Only used as a notary for identity anchoring, broadcast birth certificates (when crossing the resonance threshold), and periodic energy settlement. 

## The Resonance Field & Physics
- The UI is a visual representation of social and cultural physics.
- **Agents:** Participants exist as particles (listeners) and oscillating nodes (broadcasts). 
- **Mechanics:** 
  - *Alignment & Attraction:* Listeners moving near broadcasts merge culturally and increase the visual gravity (halo) of a node.
  - *Energy & Decay:* Broadcasting injects energy ($E_0 e^{-\lambda t}$) into the field. 
- **Identity & Trace:** Identity is cryptographic (wallet-based). Presence leaves a trace, a temporary path across cultural space.

## Cryptoeconomics (The Thermodynamics)
- **Flow Energy:** Emitted by supporting broadcasts, relaying, and archiving. It decays over time, incentivizing circulation over speculation.
- **Treasury:** A percentage of circulating Flow Energy converts into a stable operational reserve that sustains the real infrastructure (indexers, bootstrap relays). No direct user gas fees.
- **Resonance Marks:** Permanent, non-transferable proofs of participation at key cultural events. Used for governance weight.

## Development Constraints (Strict)
- The blockchain is a notary, NOT a server. Extensively expensive compute and streaming happens off-chain.
- Standard Web3 UX conventions (intrusive transaction popups, buying tokens) must be hidden; "Flow Energy" represents systemic fuel, not wealth.
- Delay UI abstraction: The system must communicate its mechanics viscerally within the first 10 seconds through sound and visual physics. No onboarding screens.
