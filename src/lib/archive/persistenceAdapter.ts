import { logger } from "@/lib/logger";
// src/lib/archive/persistenceAdapter.ts

import fs from 'fs/promises';
import path from 'path';
import { PersistenceAdapter, ResonanceEvent, SessionData } from '@/lib/contracts';

/**
 * NodeJs FS implementation of the PersistenceAdapter.
 * Handles writing binary audio chunks to the local `/archive` directory,
 * preparing them for eventual IPFS pinning without leaking filesystem logic 
 * into the main WebRTC or Simulation systems.
 */
export class FSPersistenceAdapter implements PersistenceAdapter {
    private archiveDir: string;

    constructor(baseDir: string = './archive') {
        this.archiveDir = path.resolve(process.cwd(), baseDir);
    }

    /**
     * Ensure directory structure exists: archive/broadcastId/
     */
    private async ensureDir(broadcastId: string): Promise<string> {
        const dir = path.join(this.archiveDir, broadcastId);
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
        return dir;
    }

    async saveEvent(event: ResonanceEvent): Promise<void> {
        // In Phase 3 MVP, we only care about audio archiving.
        // Event logging will be routed here later.
        logger.info("Persistence", '[Persistence] Event saved to abstract logging:', event.type);
    }

    async loadSession(sessionId: string): Promise<SessionData> {
        // Stubbed until Phase 4 identity verification requires reading old sessions
        return {
            sessionId,
            broadcastId: 'unknown',
            joinedAt: 0,
            leftAt: 0
        };
    }

    /**
     * Stores a binary audio chunk (Ogg Opus) into the hash-tree directory.
     * Format: /archive/{broadcastId}/chunk_{sequenceNum}.ogg
     * 
     * @param chunk The raw binary data
     * @param broadcastId The unique namespace for this broadcast
     * @param sequenceNum The chunk index
     * @returns The local file path (acting as the mock IPFS hash for MVP)
     */
    async storeArchive(chunk: ArrayBuffer, broadcastId: string, sequenceNum: number): Promise<string> {
        const dir = await this.ensureDir(broadcastId);

        // IPFS preparation format: zero-padded semantic chunks
        const filename = `chunk_${sequenceNum.toString().padStart(4, '0')}.ogg`;
        const fullPath = path.join(dir, filename);

        // Convert ArrayBuffer to Node Buffer for file system writing
        const buffer = Buffer.from(chunk);

        await fs.writeFile(fullPath, buffer);

        logger.info("Persistence", `[Persistence] Stored Ghost chunk -> ${fullPath} (${buffer.length} bytes)`);

        // In MVP, we return the local path pretending it's an IPFS CID hash
        return fullPath;
    }
}

// Export a singleton instance 
export const persistence = new FSPersistenceAdapter();
