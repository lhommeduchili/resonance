# Contributing to resonance

Welcome, and thank you for your interest in contributing to resonance. We are building a 
decentralized, P2P webcasting network.

Our development philosophy strongly emphasizes **embracing complexity & emotion over UI**. 
This means deferring standard UI elements (like buttons and menus) in favor of spatial audio, 
particle interactions, and WebGL/Canvas mechanics.

## How to contribute

Whether you are fixing a WebRTC edge case, optimizing the canvas rendering, or proposing a new 
cryptoeconomic mechanic, your contributions are welcome.

### 1. Understand the Architecture
Before contributing code, please familiarize yourself with the core documentation:
- [SPECIFICATIONS.md](SPECIFICATIONS.md) - The vision, architecture, and network topology.
- [PHYSICS.md](PHYSICS.md) - How the 60FPS simulation field works.
- [UX.md](UX.md) - The dark space/brutalist design guidelines.

### 2. Technical stack and rules
- **Framework & Language:** Next.js (App Router) and TypeScript (Strict).
- **Styling:** Tailwind CSS. Use utility classes to stick to the dark/space aesthetic.
- **State Management:** Use `useRef` for variables in the 60FPS animation loop. React state should 
**never** track fast-moving physics variables to prevent render bloat.
- **Error Handling:** Ensure canvas or WebRTC failures do not crash the React tree. Use error 
boundaries and handle reconnects with exponential backoff.
- **Observability:** Do not push raw `console.log` commands to production. Use structured logging to 
monitor P2P mesh performance.

### 3. Submitting Pull Requests
1. **Fork the repository** and create your branch from `main`.
2. **Write deterministic, clean code.** For math-heavy logics, keep functions pure and testable.
3. **Ensure tests pass.** If you change networking or WebRTC logic, ensure the P2P mesh tests run 
successfully.
4. **Adhere to Code Quality standards.** Ensure there are zero linting warnings (`pnpm lint`) and 
the TS compiler passes (`pnpm typecheck`).
5. **Update Documentation:** If you add a new feature or change an architecture pattern, update the corresponding `docs/` files. The documentation is the source of truth.

### 4. Issues & proposals
For major architectural changes, please open an Issue to discuss it with the maintainers before 
writing code. We want to ensure it aligns with the "Blockchain as Notary, not Server" and "Off-chain 
First" philosophies.

Thanks for helping build the collective cultural broadcasting network!
