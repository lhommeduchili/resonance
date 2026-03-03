# RESONANCE

## A Cryptoeconomic Peer-to-Peer Radio Network

**Version 0.1 --- Concept Proposal**

------------------------------------------------------------------------

## 1. Abstract

Resonance is a decentralized, peer-to-peer audio streaming network designed to reintroduce 
*collective cultural broadcasting* into the web3 era. 

Unlike contemporary algorithmic streaming platforms, resonance treats webcasting as a complex system 
where listeners, broadcasters, curators, archivists, and relay nodes participate in a shared media 
ecology.

The system combines:

-   real-time P2P audio distribution
-   cryptographic identity
-   programmable ownership
-   tokenized cultural participation
-   decentralized governance

Blockchain is not used for streaming itself, but as a **coordination and
economic layer**, enabling trustless collaboration between participants.

------------------------------------------------------------------------

## 2. Motivation

Modern streaming platforms optimize for:

-   individual consumption
-   algorithmic prediction
-   centralized ownership
-   extractive monetization

Traditional radio optimized for:

-   simultaneity
-   shared listening moments
-   cultural discovery
-   human curation

Resonance aims to merge both worlds by creating:

> **A radio where participation generates ownership and cultural
> memory.**

Listeners are not passive consumers --- they become stakeholders in
broadcasts they help sustain.

------------------------------------------------------------------------

## 3. Core Principles

### 3.1 Live First

Broadcasts exist primarily as shared temporal events.

### 3.2 Participation = Value

Economic rewards emerge from contribution, not popularity alone.

### 3.3 Decentralized Infrastructure

No central server controls distribution or access.

### 3.4 Cultural Provenance

Every broadcast leaves a verifiable historical trace.

------------------------------------------------------------------------

## 4. System Overview

The architecture separates concerns into four layers:

    ┌────────────────────────────┐
    │ Governance & Economics     │  ← Blockchain
    ├────────────────────────────┤
    │ Identity & Metadata        │  ← Signed data/IPFS
    ├────────────────────────────┤
    │ Storage & Archiving        │  ← Distributed storage
    ├────────────────────────────┤
    │ Live Audio Transport       │  ← P2P streaming
    └────────────────────────────┘

------------------------------------------------------------------------

## 5. Technical Architecture

### 5.1 Live Audio Layer (P2P Transport)

**Goal:** scalable real-time broadcasting without central servers.

**Technologies:** - WebRTC mesh + relay topology - libp2p networking -
adaptive bitrate Opus encoding - swarm relaying

Listeners automatically become relay nodes when bandwidth allows.

Key idea: \> Every listener strengthens the broadcast.

Audio packets propagate similarly to BitTorrent swarms but optimized for
low latency.

------------------------------------------------------------------------

### 5.2 Identity Layer

Each participant owns a cryptographic identity:

    identity = wallet_public_key

No accounts or passwords.

Capabilities: - broadcast signing - reputation tracking - portable
identity across clients - pseudonymous participation

Reputation emerges from historical participation rather than platform
moderation.

------------------------------------------------------------------------

### 5.3 Broadcast Objects

A live show creates a structured object:

    Broadcast {
      broadcaster_id
      start_time
      stream_hash
      participants
      contribution_events
    }

The broadcast becomes a **cultural event ledger entry**.

Listeners joining the stream cryptographically attest:

> "I was present."

This creates verifiable shared listening history.

------------------------------------------------------------------------

### 5.4 Archival Layer

After broadcast:

-   segments optionally stored via distributed storage (IPFS-like)
-   archivists earn incentives for hosting
-   broadcasts become remixable cultural artifacts

Not all broadcasts must persist --- ephemerality is a feature.

------------------------------------------------------------------------

### 5.5 Economic Layer (Blockchain)

Blockchain records only lightweight events:

-   broadcast creation
-   contribution transactions
-   governance votes
-   ownership shares

No media stored on-chain.

------------------------------------------------------------------------

## 6. Cryptoeconomic Model

### 6.1 Participation Tokens

Tokens are emitted based on:

  Contribution         Reward
  -------------------- --------
  Broadcasting         High
  Relaying bandwidth   Medium
  Archiving            Medium
  Active listening     Low

Listening itself becomes economically meaningful.

------------------------------------------------------------------------

### 6.2 Live Patronage

During broadcasts:

Listeners can stream micro-support continuously.

Instead of tipping:

    support_rate = tokens / minute

Revenue flows in real time.

------------------------------------------------------------------------

### 6.3 Cultural Shares ("Moments")

A listener supporting a broadcast receives fractional cultural shares.

These represent: - historical participation - governance weight - future
revenue share from archives/remixes

This transforms listening into co-creation.

------------------------------------------------------------------------

## 7. Governance

Resonance evolves through community governance:

Participants vote on: - protocol upgrades - funding pools - featured
broadcasts - moderation policies

Governance weight derives from long-term participation, not wealth
alone.

------------------------------------------------------------------------

## 8. Discovery Without Algorithms

Instead of recommendation AI:

Discovery emerges from: - relay proximity - social listening graphs -
trusted curators - live popularity waves

Radio becomes exploratory again.

------------------------------------------------------------------------

## 9. Emergent Properties

If successful, Resonance produces:

-   self-sustaining underground scenes
-   geographically fluid radio cultures
-   economically viable niche broadcasting
-   listener-owned media ecosystems

Radio becomes less like Spotify and more like a **distributed cultural
organism**.

------------------------------------------------------------------------

## 10. Implementation Roadmap

### Phase 1 --- Prototype

-   WebRTC broadcast client
-   wallet login
-   P2P relaying

### Phase 2 --- Cultural Ledger

-   broadcast signing
-   participation proofs
-   archival storage

### Phase 3 --- Economics

-   live micro-support
-   relay incentives

### Phase 4 --- Governance

-   DAO layer
-   community funding

------------------------------------------------------------------------

## 11. Risks

-   Token speculation overpowering culture
-   Network instability during early adoption
-   Regulatory uncertainty
-   UX complexity

Mitigation requires strong design emphasizing culture over finance.

------------------------------------------------------------------------

## 12. Vision

Resonance is not a streaming platform.

It is:

> A shared auditory commons where presence, contribution, and memory
> form a decentralized culture.

The goal is to restore radio as a collective experience --- native to
the internet, owned by its participants.
