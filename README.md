# resonance

**a cryptoeconomic peer-to-peer webcasting network**

resonance is a decentralized, peer-to-peer audio streaming network designed to reintroduce 
*collective cultural broadcasting* into the web3 era. 

unlike contemporary algorithmic streaming platforms, resonance treats webcasting as a complex system 
where listeners, broadcasters, curators, archivists, and relay nodes participate in a shared media 
ecology.

## vision

_a shared auditory commons where presence, contribution, and memory form a decentralized 
culture._

the goal is to restore radio as a collective experience — native to the internet, owned by its 
participants, and governed by its community.

## core features

-   **live first:** real-time P2P audio distribution using WebRTC mesh and relay topology.
-   **cryptographic identity:** wallet-based identity without passwords or centralized accounts.
-   **cultural ecosystem:** true P2P ecosystem with listeners, broadcasters, curators, and 
archivers.
-   **decentralized infrastructure:** no central server controls distribution or access.
-   **complexity & emotion over UI:** a spatial, dark/brutalist UX that values spatial audio-visual
experiences and emergent simulated complexity over standard menus.


## tech stack

- **frontend app:** Next.js 14+ (App Router), Canvas API for Simulation Field, WebAudio spatial engine
- **live transport:** WebRTC (STUN/TURN), Opus encoding
- **signaling layer:** Nostr ephemeral events (kind 20000 presence, kind 20001 signaling) via public relays
- **language:** TypeScript (Strict Mode)
- **styling:** Tailwind v4 (Utility-first)
- **package manager:** pnpm

## getting started

### prerequisites
- Node.js (v18+)
- pnpm

### installation

1. clone the repository:
```bash
git clone https://github.com/your-org/resonance.git
cd resonance
```

2. install dependencies:
```bash
pnpm install
```

3. run the development environment:
```bash
pnpm run dev
```

visit `http://localhost:3000` to enter the simulation field.

## documentation

comprehensive documentation about the project's vision, architecture, and mechanics can be found in the `docs/` directory:

- [resonance overview](docs/RESONANCE.md)
- [specifications](docs/SPECIFICATIONS.md)
- [architecture](docs/ARCHITECTURE.md)
- [physics & engine](docs/PHYSICS.md)
- [ux philosophy](docs/UX.md)
- [project plan](docs/PLAN.md)
- [contributing guidelines](docs/CONTRIBUTING.md)
- [code of conduct](docs/CODE_OF_CONDUCT.md)
- [security policy](docs/SECURITY.md)
- [license](docs/LICENSE.md)

## contributing

we welcome contributions to resonance! whether you want to improve the WebRTC mesh logic, refine the Canvas 60FPS simulation, or contribute to the cryptoeconomic design.

please read our [contributing guidelines](docs/CONTRIBUTING.md) and our [code of conduct](docs/CODE_OF_CONDUCT.md) before submitting pull requests.

## license

this project is licensed under the MIT License - see the [LICENSE](docs/LICENSE.md) file for 
details.
