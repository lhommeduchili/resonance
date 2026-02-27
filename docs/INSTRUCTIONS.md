# Testing Instructions for Resonance (P2P Radio)

These instructions detail how to test the core WebRTC peer-to-peer audio transmission currently implemented in the Resonance project. 

Because Resonance is a P2P application, you need to simulate at least two different clients: the **Broadcaster** (sending audio) and the **Listener** (receiving audio). 

## Prerequisites
1. Ensure you have Node.js and `pnpm` (or `npm`) installed.
2. Ensure you have a working microphone.

---

## Step 1: Start the Custom Server
We are running a custom Node.js server (`server.js`) that handles both the Next.js frontend rendering and the Socket.io signaling server (used to coordinate the P2P connections).

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
This is the node that ingests audio from your microphone and makes it available to the mesh network.

1. Open your web browser (e.g., Chrome or Firefox).
2. Navigate to the Broadcaster control panel:
   👉 **http://localhost:3000/broadcast**
3. You will see a dark, brutalist interface titled **RESONANCE INGESTION**. 
4. Click the button labeled **"IGNITE TRANSMISSION"**.
5. **Browser Permission:** Your browser will request permission to use your microphone. **Allow it.**
6. The state on the screen should change from `[ IDLE ]` to `[ LIVE ]` (in green text).
7. **Terminal Check:** Look at the terminal where your server is running. You should see Logs confirming the broadcaster registered:
   ```
   Node Connected: <some-socket-id>
   Root Broadcaster Registered: <some-socket-id>
   ```
8. **Leave this tab open** and your microphone unmuted.

---

## Step 3: Connect a Listener (Consumer/Peer)
This simulates a user tuning into the Resonance radio field.

1. Open a **New Browser Tab** (or a completely different browser window/Profile to ensure isolated contexts).
2. Navigate to the main simulation page:
   👉 **http://localhost:3000/**
3. You will see the dark Simulation Field with glowing particles.
4. **Important:** Look at the bottom-left corner of the screen. It will say:
   `AWAITING SIGNAL (CLICK TO TUNE)`
5. **Click anywhere on the web page.** Modern web browsers require a user interaction (like a click) before they allow audio to autoplay.
6. Observe the bottom-left text. It will progress through the WebRTC connection phases:
   - `NEGOTIATING PHASE...` 
   - `RESONANCE STABILIZED` 
7. Once stabilized, it will show `Active Peers: 1`. 
8. **The Audio Test:** Speak into your microphone (the one captured by the Broadcaster tab). You should hear your voice echoed back through the Listener tab.
9. **Terminal Check:** You will see a new `Node Connected` log in your terminal, representing the listener joining the socket pool to exchange WebRTC SDP answers/offers.

---

## Step 4: Test Mesh Limits (Optional)
To test how the system handles multiple theoretical peers:
1. Open several more tabs to **http://localhost:3000/**.
2. Click on the screen in each tab to initiate the connection.
3. Check the `Active Peers` count on the listener UI and the `Direct Peers` count on the `/broadcast` UI to confirm the network state is updating dynamically.

## Troubleshooting
- **Cannot hear audio:** Ensure the Listener tab is not muted in your OS volume mixer or by the browser tab itself. Check the browser console on the Listener tab (`F12` -> Console) for any WebRTC or MediaStream errors.
- **Microphone error:** If the Broadcaster UI says "Microphone access denied", check your browser's site settings (`lock icon` in the URL bar) and reset the microphone permission, then reload the page.
- **Server crash:** If `server.js` throws an error and dies, check that port 3000 is not being used by another application.
