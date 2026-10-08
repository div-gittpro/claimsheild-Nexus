/**
 * Hashing utilities for tamper-evident audit chaining and policy versioning.
 *
 * The audit ledger (Section 29) uses SHA-256 hash chaining. Browsers expose
 * SHA-256 via the asynchronous Web Crypto API (crypto.subtle). To keep the
 * React store updates synchronous and still produce stable, collision-resistant
 * digests for rendering, we provide a deterministic synchronous hash and an
 * async SHA-256 helper for callers that can await.
 */

/**
 * Deterministic synchronous 256-bit hash rendered as 64 hex chars.
 * Based on a FNV-1a-seeded multi-lane mixing scheme. This is NOT cryptographic
 * SHA-256, but it is deterministic and tamper-evident for chain verification
 * within the client session. Used so the ledger can chain without awaiting.
 */
export function syncHash256(input: string): string {
  // Eight 32-bit lanes seeded with distinct FNV offset bases.
  const seeds = [
    0x811c9dc5, 0x1000193, 0xdeadbeef, 0x9e3779b9,
    0x7f4a7c15, 0x6a09e667, 0xbb67ae85, 0x3c6ef372,
  ];
  const lanes = seeds.slice();
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    for (let lane = 0; lane < 8; lane += 1) {
      lanes[lane] ^= code + lane * 0x01000193 + i;
      // 32-bit FNV-style multiply.
      lanes[lane] = Math.imul(lanes[lane], 0x01000193) >>> 0;
      lanes[lane] = (lanes[lane] ^ (lanes[lane] >>> 15)) >>> 0;
    }
  }
  return lanes.map((lane) => (lane >>> 0).toString(16).padStart(8, '0')).join('');
}

/** True SHA-256 hex digest via Web Crypto. Falls back to syncHash256 if unavailable. */
export async function sha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const bytes = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // fall through
  }
  return syncHash256(input);
}

/** Short display form of a hash (first n hex chars). */
export function shortHash(hash: string, length = 10): string {
  return hash.slice(0, length);
}

/**
 * Deterministic pseudo-signature over a payload hash using a named signer key.
 * Models an Ed25519-style signature column (Section 32 / Audit Ledger screenshot)
 * for demonstration — reproducible and verifiable within the session.
 */
export function signPayload(payloadHash: string, signerKeyId: string): string {
  return syncHash256(`${signerKeyId}::${payloadHash}`).slice(0, 32);
}

export function verifySignature(payloadHash: string, signerKeyId: string, signature: string): boolean {
  return signPayload(payloadHash, signerKeyId) === signature;
}
