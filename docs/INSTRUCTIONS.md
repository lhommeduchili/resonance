# Testing Instructions for Resonance (P2P Radio)

These instructions detail how to test the core WebRTC peer-to-peer audio transmission currently implemented in the Resonance project.

Because Resonance is a decentralized P2P application, you need to simulate at least two different clients: the **Broadcaster** (sending audio) and the **Listener** (receiving audio). The clients coordinate via decentralized Nostr relays, avoiding any centralized signaling server.

## Prerequisites
1. Ensure you have Node.js and `pnpm` (or `npm`) installed.
2. Ensure you have a working microphone.

---

## Step 1: Start the Local Environment
Resonance runs as a standard Next.js application.

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
This simulates a user tuning into the Resonance radio field. They will pull signaling metadata from the Nostr relays and establish a direct WebRTC connection with the Broadcaster.

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
