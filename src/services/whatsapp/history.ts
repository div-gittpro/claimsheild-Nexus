import { useSyncExternalStore } from 'react';

/**
 * UI-only WhatsApp notification history (Section 11).
 *
 * This is deliberately client-side and ephemeral — there is NO backend delivery
 * tracking in this phase. Entries are always "PREPARED"; we never fabricate a
 * "Delivered" status because ClaimShield cannot observe WhatsApp delivery.
 */

export interface WhatsAppHistoryEntry {
  id: string;
  caseId: string;
  recipientLabel: string;
  status: 'PREPARED';
  preparedAt: string;
}

let entries: WhatsAppHistoryEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function addWhatsAppHistory(entry: Omit<WhatsAppHistoryEntry, 'id' | 'status'>): void {
  const record: WhatsAppHistoryEntry = {
    id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: 'PREPARED',
    ...entry,
  };
  entries = [record, ...entries].slice(0, 100);
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** All history, newest first. */
export function useWhatsAppHistory(): WhatsAppHistoryEntry[] {
  return useSyncExternalStore(subscribe, () => entries, () => entries);
}

/** History for a single case. */
export function useWhatsAppHistoryForCase(caseId: string): WhatsAppHistoryEntry[] {
  const all = useWhatsAppHistory();
  return all.filter((e) => e.caseId === caseId);
}
