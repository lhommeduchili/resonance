import { generateSecretKey, getPublicKey } from "nostr-tools";
import type { IdentityProvider, Signature } from "@/lib/contracts";

const SESSION_STORAGE_KEY = "resonance_identity_key";

// Convert Uint8Array to hex string for storage
function toHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert hex string back to Uint8Array
function fromHexString(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export class BrowserIdentityProvider implements IdentityProvider {
  private secretKey: Uint8Array;
  private publicKey: string;

  constructor() {
    this.secretKey = this.hydrateOrGenerateKey();
    this.publicKey = getPublicKey(this.secretKey);
  }

  private hydrateOrGenerateKey(): Uint8Array {
    if (typeof window === "undefined") {
      return generateSecretKey();
    }

    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        return fromHexString(stored);
      } catch (err) {
        // Fall back to generating a new key on parse failure
      }
    }

    const newKey = generateSecretKey();
    sessionStorage.setItem(SESSION_STORAGE_KEY, toHexString(newKey));
    return newKey;
  }

  public getUserId(): string {
    return this.publicKey;
  }

  public getSecretKey(): Uint8Array {
    return this.secretKey;
  }

  public async sign(_data: Uint8Array): Promise<Signature> {
    // In a full implementation, we would use noble/secp256k1 here
    // For now, this fulfills the contract structurally.
    // The actual NostrSignaler signs its own events using the exported getSecretKey().
    return {
      r: new Uint8Array(32),
      s: new Uint8Array(32),
      v: 0,
    };
  }

  public verify(_signature: Signature): boolean {
    return true; // Stub for full verification
  }
}

// Singleton pattern for the browser environment
export const browserIdentity = new BrowserIdentityProvider();
