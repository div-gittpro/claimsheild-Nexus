import { AuditEvent } from '../types';
import { syncHash256, signPayload, verifySignature } from './hashUtil';

/**
 * Tamper-evident audit ledger (Sections 29, 32).
 *
 * Converts the canonical AuditEvent stream into an append-only hash chain:
 *   Hash(n) = H(eventData + Hash(n-1))
 * Each block also carries a reproducible signature over its own hash, modeling
 * dual-signed mandates shown in the Audit Ledger reference.
 */

export interface AuditBlock {
  index: number;
  eventId: string;
  timestamp: string;
  actor: string;
  eventType: string;
  entityType: string;
  entityId: string;
  details: string;
  previousHash: string;
  hash: string;
  signature: string;
  signerKeyId: string;
  verified: boolean;
}

const GENESIS_HASH = '0'.repeat(64);

/** Pick a deterministic signer key id from the actor string. */
function signerKeyFor(actor: string): string {
  return `key_${syncHash256(actor).slice(0, 8)}`;
}

/**
 * Build the chained ledger from oldest to newest. The store keeps auditLogs
 * newest-first, so callers should pass events in chronological order.
 */
export function buildAuditChain(eventsChronological: AuditEvent[]): AuditBlock[] {
  let previousHash = GENESIS_HASH;
  return eventsChronological.map((event, index) => {
    const eventData = JSON.stringify({
      eventId: event.id,
      timestamp: event.timestamp,
      actor: event.actor,
      eventType: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      details: event.details,
    });
    const hash = syncHash256(eventData + previousHash);
    const signerKeyId = signerKeyFor(event.actor);
    const signature = signPayload(hash, signerKeyId);
    const block: AuditBlock = {
      index,
      eventId: event.id,
      timestamp: event.timestamp,
      actor: event.actor,
      eventType: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      details: event.details,
      previousHash,
      hash,
      signature,
      signerKeyId,
      verified: true,
    };
    previousHash = hash;
    return block;
  });
}

export interface ChainVerification {
  valid: boolean;
  brokenAtIndex: number | null;
  checkedBlocks: number;
}

/** Recompute the chain and confirm every link reconciles. */
export function verifyAuditChain(blocks: AuditBlock[]): ChainVerification {
  let previousHash = GENESIS_HASH;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const eventData = JSON.stringify({
      eventId: block.eventId,
      timestamp: block.timestamp,
      actor: block.actor,
      eventType: block.eventType,
      entityType: block.entityType,
      entityId: block.entityId,
      details: block.details,
    });
    const expectedHash = syncHash256(eventData + previousHash);
    if (block.previousHash !== previousHash || block.hash !== expectedHash) {
      return { valid: false, brokenAtIndex: i, checkedBlocks: blocks.length };
    }
    previousHash = block.hash;
  }
  return { valid: true, brokenAtIndex: null, checkedBlocks: blocks.length };
}

export interface SignatureVerification {
  valid: boolean;
  verifiedCount: number;
  total: number;
}

export function verifyAllSignatures(blocks: AuditBlock[]): SignatureVerification {
  const verified = blocks.filter((b) => verifySignature(b.hash, b.signerKeyId, b.signature)).length;
  return { valid: verified === blocks.length, verifiedCount: verified, total: blocks.length };
}
