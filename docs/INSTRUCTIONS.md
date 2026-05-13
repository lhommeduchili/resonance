# Testing Instructions for resonance (P2P Radio)

These instructions detail how to test the core WebRTC peer-to-peer audio transmission currently implemented in the resonance project.

Because resonance is a decentralized P2P application, you need to simulate at least two different clients: the **Broadcaster** (sending audio) and the **Listener** (receiving audio). The clients coordinate via decentralized Nostr relays, avoiding any centralized signaling server.

## Prerequisites
1. Ensure you have Node.js and `pnpm` (or `npm`) installed.
2. Ensure you have a working microphone.

---

## Step 1: Start the Local Environment
resonance runs as a standard Next.js application.

1. Open a terminal and navigate to the project root directory.
2. Run the development server:
   ```bash
   pnpm dev
   ```
   *(Or `npm run dev` depending on your package manager).*
3. Wait for the terminal to output:
   `> Ready on http://localhost:3000`

---

## Step 2: Initialize the Broadcaster (Creator)
This is the node that ingests audio from your microphone and makes it available to the mesh network via WebRTC and Nostr signaling.

1. Open your web browser (e.g., Chrome or Firefox).
2. Navigate to the Broadcaster control panel:
   👉 **http://localhost:3000/broadcast**
3. You will see a dark, brutalist interface titled **RESONANCE INGESTION**.
4. Click the button labeled **"IGNITE TRANSMISSION"**.
5. **Browser Permission:** Your browser will request permission to use your microphone. **Allow it.**
6. The state on the screen should change from `[ IDLE ]` to `[ LIVE ]` (in green text).
7. **Leave this tab open** and your microphone unmuted.

---

## Step 3: Connect a Listener (Consumer/Peer)
This simulates a user tuning into the resonance radio field. They will pull signaling metadata from the Nostr relays and establish a direct WebRTC connection with the Broadcaster.

1. Open a **New Browser Tab** (or a completely different browser window/Profile to ensure isolated audio contexts).
2. Navigate to the main simulation page:
   👉 **http://localhost:3000/**
3. You will see the dark Simulation Field with glowing particles.
4. **Important:** Look at the bottom-left corner of the screen. It will initially say:
   `AWAITING SIGNAL (CLICK TO TUNE)`
5. **Click anywhere on the web page.** Modern web browsers require a user interaction before allowing an AudioContext to start processing sound.
6. The text will progress through connection phases (e.g., `NEGOTIATING PHASE...`, `RESONANCE STABILIZED`).
7. Once connected, check the telemetry stats. Wait a moment for the latency metrics to stabilize.
8. **The Audio Test:** Speak into your microphone (the one captured by the Broadcaster tab). You should hear your voice echoed back through the Listener tab.

---

## Step 4: Test Mesh Scaling (Optional)
To test how the system manages multiple peers in a decentralized context:
1. Open several more tabs to **http://localhost:3000/**.
2. Click on the screen in each tab to initiate the connection.
3. Once multiple listeners have joined, examine the UI on both the broader network map and the Broadcaster panel. You will notice that the network automatically assigns `Relay` roles to certain listeners based on node capacity and apparent proximity, preventing the Broadcaster from establishing direct connections to every single listener.

## Troubleshooting
- **Cannot hear audio:** Ensure the Listener tab is not muted in your OS volume mixer. Check the browser console on the Listener tab (`F12` -> Console) for WebRTC ICE candidate failures or MediaStream errors.
- **Microphone error:** If the Broadcaster UI says "Microphone access denied" or fails to capture audio, check your browser's site settings (`lock icon` in the URL bar), reset the microphone permission, and reload the page.
- **Nostr Relay Issues:** The initial WebRTC signaling depends on external Nostr relays (e.g., `wss://relay.damus.io`). If these public relays are down or severely rate-limiting, the peers will fail to discover each other. Check the browser console (`F12`) for `NostrSignaler` errors.

---

## Deploying the Broadcaster (Desktop App)
To run the Broadcaster as a standalone desktop application (Electron), use the local build scripts or the GitHub Releases workflow.

1. Install dependencies if you haven't already:
   ```bash
   pnpm install
   ```
2. Run the Electron build script for your target platform:
   ```bash
   # macOS Apple Silicon
   pnpm run electron:build

   # macOS x64 + arm64
   pnpm run electron:build:mac

   # Windows
   pnpm run electron:build:win

   # Linux
   pnpm run electron:build:linux
   ```
3. Wait for the build process to finish. It will first generate a static Next.js export in the `out/` directory, and then `electron-builder` will package the app.
4. Locate the generated artifact in the `dist/` directory.

To publish a multi-platform release, make sure the release workflow has already been committed and pushed.
GitHub runs workflows from the exact commit the tag points to, so pushing a tag before
`.github/workflows/release.yml` exists on that commit will not create a release.

### First release / retrying a failed tag

If `v0.1.0` was already pushed before the release workflow was committed, delete and recreate it:

```bash
# 1. commit and push the release pipeline
git add package.json pnpm-workspace.yaml electron-builder.yml build/entitlements.mac.plist .github/workflows/ci.yml .github/workflows/release.yml .gitignore README.md docs/INSTRUCTIONS.md docs/PLAN.md eslint.config.mjs
git commit -m "Add desktop release pipeline"
git push origin main

# 2. delete the old tag that points to the pre-workflow commit
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# 3. recreate the tag on the commit that contains the workflow
git tag v0.1.0
git push origin v0.1.0
```

### Future releases

```bash
# 1. bump package.json without creating a tag yet
pnpm version patch --no-git-tag-version

# 2. commit and push the version bump
git add package.json
git commit -m "Bump version"
git push origin main

# 3. tag the committed version and push the tag
git tag v0.1.1
git push origin v0.1.1
```

After the tag is pushed, open **GitHub -> Actions -> release** and wait for the workflow to finish.
If the workflow fails, no release is created; open the failed job and fix that first.
GitHub Actions builds macOS, Windows, and Linux artifacts, then creates a draft GitHub Release.

---

## Deploying the Listeners (Vercel)
The Listener visualization field and peer nodes are intended to be deployed on the web. Vercel is the recommended platform for Next.js applications.

1. Ensure your code is pushed to a GitHub repository.
2. Log in to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Vercel will automatically detect that this is a Next.js project. Ensure the Build Command is set to `next build` and the Output Directory is left as default (or `.next`).
5. Set any necessary Environment Variables (if your Nostr signaling requires them).
6. Click **Deploy**. Within a few minutes, the resonance web client will be live on a public URL.

### Manual Vercel Deployment via CLI
If you already have a Vercel project named `resonance` deployed and wish to push updates manually from the command line:

1. Install the Vercel CLI globally (if you haven't yet):
   ```bash
   pnpm add -g vercel
   ```
2. Link your local directory to your existing Vercel project:
   ```bash
   vercel link
   ```
3. Deploy the application to your existing setup:
   ```bash
   vercel --prod
   ```
