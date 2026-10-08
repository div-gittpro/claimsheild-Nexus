/**
 * Frontend notification client.
 *
 * This talks ONLY to the ClaimShield backend. It never contains WhatsApp
 * credentials and never calls the WhatsApp API directly (Sections 1, 34).
 * The backend owns the event bus, policy, queue, worker and provider.
 */

import { CaseRecord, NetworkCluster, Provider } from '../types';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DeliveryStatus =
  | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RETRYING' | 'DEAD_LETTER';

export interface NotificationRecord {
  notificationId: string;
  caseId: string;
  providerId?: string;
  networkId?: string;
  investigatorId: string;
  investigatorName: string;
  notificationType: string;
  templateName: string;
  bodyText: string;
  caseUrl: string;
  status: DeliveryStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  history: { status: DeliveryStatus; at: string; note?: string }[];
  read: boolean;
  unassigned: boolean;
}

export interface WhatsAppAlertPolicy {
  enabled: boolean;
  minimumSeverity: Severity;
  minimumConfidence: number;
  minimumRiskScore: number;
  notifyOnNewCase: boolean;
  notifyOnCriticalAnomaly: boolean;
  notifyOnRiskEscalation: boolean;
  notifyOnNetworkEscalation: boolean;
  cooldownMinutes: number;
  riskEscalationMinChange: number;
  networkEscalationThreshold: number;
}

export interface Investigator {
  investigatorId: string;
  name: string;
  role: string;
  phoneNumber: string;
  whatsappEnabled: boolean;
  active: boolean;
  isDutyOfficer?: boolean;
  notificationPreferences: {
    criticalAnomaly: boolean;
    newCase: boolean;
    riskEscalation: boolean;
    networkEscalation: boolean;
  };
}

export interface NotificationMetrics {
  alertsGenerated: number;
  alertsSent: number;
  alertsDelivered: number;
  alertsRead: number;
  alertsFailed: number;
  deadLettered: number;
  duplicatesPrevented: number;
  cooldownSuppressed: number;
  deliveryRate: number;
  failureRate: number;
  averageDeliveryLatencyMs: number;
}

function severityForCase(c: CaseRecord): Severity {
  if (c.riskScore >= 85) return 'CRITICAL';
  if (c.riskScore >= 70) return 'HIGH';
  if (c.riskScore >= 45) return 'MEDIUM';
  return 'LOW';
}

/** Map canonical case/network state into the backend snapshot shape. */
export function buildAnalysisSnapshot(
  analysisRunId: string,
  cases: CaseRecord[],
  providers: Provider[],
  networks: NetworkCluster[],
) {
  void providers;
  return {
    analysisRunId,
    cases: cases.map((c) => {
      const detectorTypeCount = c.evidenceTypes?.length || new Set(c.evidenceBreakdown.map((e) => e.ruleName)).size;
      const confidence = Math.round((c.evidenceStrength / 100) * (c.forecastConfidence > 0 ? c.forecastConfidence / 100 : 1) * 100) / 100;
      const normalizedConfidence = Math.max(0, Math.min(1, c.evidenceStrength / 100 + (c.riskScore >= 85 ? 0.2 : 0)));
      return {
        caseId: c.id,
        providerId: c.targetId,
        providerName: c.targetName,
        specialty: c.specialty,
        status: c.status,
        riskScore: c.riskScore,
        evidenceStrength: c.evidenceStrength,
        confidence: Number.isFinite(normalizedConfidence) ? Math.max(confidence, normalizedConfidence) : c.evidenceStrength / 100,
        severity: severityForCase(c),
        estimatedExposure: c.estimatedExposure,
        networkId: c.networkId,
        networkRiskScore: c.networkRiskScore,
        evidenceCount: c.evidenceBreakdown.length,
        detectorTypeCount,
        affectedMembersCount: c.affectedMembersCount,
        assignedInvestigatorId: c.assignedInvestigator ? mapInvestigatorNameToId(c.assignedInvestigator) : undefined,
        evidenceIds: c.evidenceIds || c.evidenceBreakdown.map((e) => e.id),
        anomalyType: detectorTypeCount > 1 ? 'Multiple corroborating FWA signals' : (c.evidenceTypes?.[0]?.replace(/_/g, ' ') || 'FWA signal'),
        shortReason: `${c.evidenceBreakdown.length} signals across ${detectorTypeCount} detector ${detectorTypeCount === 1 ? 'type' : 'types'}${c.networkRiskScore >= 70 ? ' with elevated network exposure' : ''}.`,
      };
    }),
    networks: networks.map((n) => ({
      networkId: n.id,
      riskScore: n.riskScore,
      connectedProviders: n.providerCount,
      referralRelationships: Math.max(0, Math.round(n.referralDensity * n.totalClaimsCount)),
    })),
  };
}

/** The seeded backend investigators use INV-00x ids; map a display name if present. */
function mapInvestigatorNameToId(name: string): string | undefined {
  const n = name.toLowerCase();
  if (n.includes('jenkins')) return 'INV-001';
  if (n.includes('alvarez')) return 'INV-002';
  return undefined;
}

async function j<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const notificationService = {
  async getConfig() {
    return j<{ mode: string; provider: string; enabled: boolean; templateName: string }>('/api/notifications/config');
  },
  async ingest(payload: ReturnType<typeof buildAnalysisSnapshot>) {
    return j<{ ok: boolean; result: { evaluated: number; queued: number; suppressed: { caseId: string; reason: string }[] } }>(
      '/api/notifications/ingest',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    );
  },
  async list(limit = 50) {
    return j<{ unreadCount: number; notifications: NotificationRecord[] }>(`/api/notifications/notifications?limit=${limit}`);
  },
  async markRead(ids?: string[]) {
    return j<{ ok: boolean; unreadCount: number }>('/api/notifications/notifications/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    });
  },
  async forCase(caseId: string) {
    return j<{ notifications: NotificationRecord[] }>(`/api/notifications/case/${encodeURIComponent(caseId)}`);
  },
  async getPolicy() {
    return j<{ policy: WhatsAppAlertPolicy }>('/api/notifications/policy');
  },
  async updatePolicy(patch: Partial<WhatsAppAlertPolicy>) {
    return j<{ policy: WhatsAppAlertPolicy }>('/api/notifications/policy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
  },
  async getInvestigators() {
    return j<{ investigators: Investigator[] }>('/api/notifications/investigators');
  },
  async updatePreferences(id: string, prefs: Partial<Investigator['notificationPreferences']>) {
    return j<{ investigator: Investigator }>(`/api/notifications/investigators/${encodeURIComponent(id)}/preferences`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs),
    });
  },
  async getMetrics() {
    return j<{ metrics: NotificationMetrics; queue: { processed: number; deadLettered: number }; mode: string }>(
      '/api/notifications/metrics',
    );
  },
};
