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


## downloads

resonance broadcaster is available as a desktop app for macOS, Windows, and Linux.

**Download the latest release:** https://github.com/lhommeduchili/resonance/releases/latest

### macOS installation

the app is ad-hoc signed (not notarized with Apple). macOS Gatekeeper will show a warning on first launch:

1. download the `.dmg` for your architecture (Apple Silicon = `arm64`, Intel = `x64`)
2. drag `resonance.app` to your Applications folder
3. **right-click** (or Control-click) the app, then select **open**
4. click **open** in the dialog that appears
5. the app will launch normally from now on

> if macOS says the app is "damaged," run this in Terminal:
> ```bash
> xattr -cr /Applications/resonance.app
> ```

### Windows installation

download the `.exe` installer and run it. Windows SmartScreen may show a warning; click "more info", then "run anyway."

### Linux installation

download the `.AppImage`, make it executable (`chmod +x resonance-*.AppImage`), and run it.



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
git clone https://github.com/lhommeduchili/resonance.git
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

### broadcaster desktop app (local build)

to build the Electron broadcaster app locally:

```bash
# macOS (Apple Silicon)
pnpm run electron:build

# macOS (x64 + arm64)
pnpm run electron:build:mac

# Windows
pnpm run electron:build:win

# Linux
pnpm run electron:build:linux
```

built artifacts appear in the `dist/` directory.

### creating a release

releases are automated via GitHub Actions. the release workflow must be committed and pushed before
you push the tag, because GitHub runs the workflow from the exact commit the tag points to.

#### first release / retrying a failed tag

```bash
# 1. commit and push the release pipeline changes
git add package.json electron-builder.yml build/entitlements.mac.plist .github/workflows/release.yml .gitignore README.md docs/INSTRUCTIONS.md docs/PLAN.md eslint.config.mjs
git commit -m "Add desktop release pipeline"
git push origin main

# 2. if v0.1.0 was already pushed before the workflow existed, delete that bad tag
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# 3. recreate the tag on the commit that contains the workflow
git tag v0.1.0
git push origin v0.1.0
```

#### future releases

```bash
# 1. bump package.json to the next version and commit it
pnpm version patch --no-git-tag-version
git add package.json
git commit -m "Bump version"
git push origin main

# 2. tag the committed version and push the tag
git tag v0.1.1
git push origin v0.1.1
```

after the tag is pushed, open **GitHub -> Actions -> release** and wait for the workflow to finish.
it creates a draft GitHub Release with the `.dmg`, `.zip`, `.exe`, and `.AppImage` artifacts attached.

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
