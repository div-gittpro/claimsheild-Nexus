import {
  Investigator,
  NotificationEventType,
  NotificationRecord,
  WhatsAppAlertPolicy,
  DeliveryStatus,
} from './types';
import { DEFAULT_POLICY } from './alertPolicy';

/**
 * In-process persistence for the notification pipeline.
 *
 * The project has no Redis/BullMQ, so this module provides an equivalent
 * in-memory store (policy, investigators, notifications, risk/network baselines,
 * audit events and metrics). It is a drop-in boundary: swapping to Redis later
 * only requires reimplementing these functions.
 */

interface NotificationAuditEvent {
  id: string;
  eventType: string;
  caseId?: string;
  anomalyId?: string;
  investigatorId?: string;
  notificationId?: string;
  templateName?: string;
  deliveryStatus?: DeliveryStatus;
  timestamp: string;
  details: string;
}

interface Metrics {
  alertsGenerated: number;
  alertsSent: number;
  alertsDelivered: number;
  alertsRead: number;
  alertsFailed: number;
  deadLettered: number;
  duplicatesPrevented: number;
  cooldownSuppressed: number;
  totalDeliveryLatencyMs: number;
  deliveredCount: number;
}

class NotificationStore {
  private policy: WhatsAppAlertPolicy = { ...DEFAULT_POLICY };
  private investigators: Investigator[] = seedInvestigators();
  private notifications = new Map<string, NotificationRecord>();
  private dedupIndex = new Set<string>();
  private providerMessageIndex = new Map<string, string>(); // providerMessageId -> notificationId
  /** Last alert time per (investigatorId + logical subject) for cooldown. */
  private cooldownIndex = new Map<string, number>();
  private providerRiskBaseline = new Map<string, number>(); // providerId -> last risk
  private networkRiskBaseline = new Map<string, number>(); // networkId -> last risk
  private seenCases = new Set<string>(); // analysisRunId:caseId already evaluated
  private audit: NotificationAuditEvent[] = [];
  private metrics: Metrics = {
    alertsGenerated: 0,
    alertsSent: 0,
    alertsDelivered: 0,
    alertsRead: 0,
    alertsFailed: 0,
    deadLettered: 0,
    duplicatesPrevented: 0,
    cooldownSuppressed: 0,
    totalDeliveryLatencyMs: 0,
    deliveredCount: 0,
  };

  /* ---- policy ---- */
  getPolicy(): WhatsAppAlertPolicy {
    return { ...this.policy };
  }
  updatePolicy(patch: Partial<WhatsAppAlertPolicy>): WhatsAppAlertPolicy {
    this.policy = { ...this.policy, ...patch };
    return this.getPolicy();
  }

  /* ---- investigators ---- */
  listInvestigators(): Investigator[] {
    return this.investigators.map((i) => ({ ...i }));
  }
  getInvestigator(id?: string): Investigator | undefined {
    if (!id) return undefined;
    const found = this.investigators.find((i) => i.investigatorId === id);
    return found ? { ...found } : undefined;
  }
  getDutyOfficer(): Investigator | undefined {
    const found = this.investigators.find((i) => i.isDutyOfficer && i.active);
    return found ? { ...found } : undefined;
  }
  updateInvestigatorPreferences(id: string, prefs: Partial<Investigator['notificationPreferences']>): Investigator | undefined {
    const inv = this.investigators.find((i) => i.investigatorId === id);
    if (!inv) return undefined;
    inv.notificationPreferences = { ...inv.notificationPreferences, ...prefs };
    return { ...inv };
  }

  /* ---- dedup + cooldown ---- */
  hasDedup(key: string): boolean {
    return this.dedupIndex.has(key);
  }
  addDedup(key: string): void {
    this.dedupIndex.add(key);
  }
  /** Returns remaining cooldown ms (0 if clear) and records the stamp when sending. */
  cooldownRemainingMs(cooldownSubject: string, cooldownMinutes: number): number {
    const last = this.cooldownIndex.get(cooldownSubject);
    if (last === undefined) return 0;
    const elapsed = Date.now() - last;
    const window = cooldownMinutes * 60_000;
    return elapsed >= window ? 0 : window - elapsed;
  }
  stampCooldown(cooldownSubject: string): void {
    this.cooldownIndex.set(cooldownSubject, Date.now());
  }

  /* ---- escalation baselines ---- */
  getProviderBaseline(providerId: string): number | undefined {
    return this.providerRiskBaseline.get(providerId);
  }
  setProviderBaseline(providerId: string, risk: number): void {
    this.providerRiskBaseline.set(providerId, risk);
  }
  getNetworkBaseline(networkId: string): number | undefined {
    return this.networkRiskBaseline.get(networkId);
  }
  setNetworkBaseline(networkId: string, risk: number): void {
    this.networkRiskBaseline.set(networkId, risk);
  }
  markCaseSeen(key: string): boolean {
    if (this.seenCases.has(key)) return true;
    this.seenCases.add(key);
    return false;
  }

  /* ---- notifications ---- */
  saveNotification(rec: NotificationRecord): void {
    this.notifications.set(rec.notificationId, rec);
    if (rec.providerMessageId) this.providerMessageIndex.set(rec.providerMessageId, rec.notificationId);
  }
  getNotification(id: string): NotificationRecord | undefined {
    return this.notifications.get(id);
  }
  getByProviderMessageId(providerMessageId: string): NotificationRecord | undefined {
    const id = this.providerMessageIndex.get(providerMessageId);
    return id ? this.notifications.get(id) : undefined;
  }
  listNotifications(limit = 50): NotificationRecord[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  listNotificationsForCase(caseId: string): NotificationRecord[] {
    return Array.from(this.notifications.values())
      .filter((n) => n.caseId === caseId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  unreadCount(): number {
    let n = 0;
    this.notifications.forEach((rec) => {
      if (!rec.read) n += 1;
    });
    return n;
  }
  markRead(ids?: string[]): void {
    if (!ids) {
      this.notifications.forEach((rec) => {
        rec.read = true;
      });
      return;
    }
    ids.forEach((id) => {
      const rec = this.notifications.get(id);
      if (rec) rec.read = true;
    });
  }

  updateStatus(id: string, status: DeliveryStatus, note?: string): NotificationRecord | undefined {
    const rec = this.notifications.get(id);
    if (!rec) return undefined;
    rec.status = status;
    rec.updatedAt = new Date().toISOString();
    rec.history.push({ status, at: rec.updatedAt, note });
    return rec;
  }

  /* ---- audit ---- */
  addAudit(event: Omit<NotificationAuditEvent, 'id' | 'timestamp'> & { timestamp?: string }): NotificationAuditEvent {
    const rec: NotificationAuditEvent = {
      id: `NAUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      ...event,
    };
    this.audit.unshift(rec);
    return rec;
  }
  listAudit(limit = 100): NotificationAuditEvent[] {
    return this.audit.slice(0, limit);
  }

  /* ---- metrics ---- */
  bump(metric: keyof Metrics, by = 1): void {
    this.metrics[metric] += by;
  }
  recordDeliveryLatency(ms: number): void {
    this.metrics.totalDeliveryLatencyMs += ms;
    this.metrics.deliveredCount += 1;
  }
  getMetrics() {
    const m = this.metrics;
    const deliveryRate = m.alertsGenerated > 0 ? m.alertsDelivered / m.alertsGenerated : 0;
    const failureRate = m.alertsGenerated > 0 ? (m.alertsFailed + m.deadLettered) / m.alertsGenerated : 0;
    const avgLatency = m.deliveredCount > 0 ? Math.round(m.totalDeliveryLatencyMs / m.deliveredCount) : 0;
    return {
      ...m,
      deliveryRate: Math.round(deliveryRate * 1000) / 1000,
      failureRate: Math.round(failureRate * 1000) / 1000,
      averageDeliveryLatencyMs: avgLatency,
    };
  }

  /** Reset per-run transient state when a brand new analysis run is ingested. */
  resetForRun(analysisRunId: string): void {
    void analysisRunId;
    // Baselines persist across runs so escalations can be detected; nothing to clear here.
  }
}

function seedInvestigators(): Investigator[] {
  const allPrefs = { criticalAnomaly: true, newCase: true, riskEscalation: true, networkEscalation: true };
  return [
    {
      investigatorId: 'INV-001',
      name: 'Investigator Jenkins',
      role: 'Senior SIU Investigator',
      phoneNumber: process.env.WHATSAPP_DEMO_RECIPIENT || '+10000000001',
      whatsappEnabled: true,
      active: true,
      notificationPreferences: { ...allPrefs },
    },
    {
      investigatorId: 'INV-002',
      name: 'Investigator Alvarez',
      role: 'SIU Investigator',
      phoneNumber: '+10000000002',
      whatsappEnabled: true,
      active: true,
      notificationPreferences: { ...allPrefs },
    },
    {
      investigatorId: 'INV-DUTY',
      name: 'SIU Duty Officer',
      role: 'Duty Officer',
      phoneNumber: process.env.WHATSAPP_DUTY_OFFICER || '+10000000009',
      whatsappEnabled: true,
      active: true,
      isDutyOfficer: true,
      notificationPreferences: { ...allPrefs },
    },
  ];
}

export const notificationStore = new NotificationStore();
export type { NotificationAuditEvent };
