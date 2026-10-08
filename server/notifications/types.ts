/**
 * Event-driven WhatsApp alerting — shared backend domain types.
 *
 * These types model the notification pipeline described in the product spec.
 * They are intentionally decoupled from the frontend analytical state: the
 * backend receives a lightweight analysis snapshot and derives events from it,
 * so the analytical/risk/SIU/case source of truth is never modified.
 */

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export type NotificationEventType =
  | 'ANOMALY_DETECTED'
  | 'HIGH_SEVERITY_ANOMALY'
  | 'SIU_CASE_CREATED'
  | 'RISK_ESCALATED'
  | 'NETWORK_RISK_ESCALATED'
  | 'CASE_ASSIGNED'
  | 'INVESTIGATION_DEADLINE_APPROACHING';

export type DeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RETRYING'
  | 'DEAD_LETTER';

/* ---------- Internal events ---------- */

export interface AnomalyDetectedEvent {
  eventId: string;
  analysisRunId: string;
  timestamp: string;
  anomalyId: string;
  providerId?: string;
  claimId?: string;
  memberId?: string;
  facilityId?: string;
  anomalyType: string;
  severity: Severity;
  confidence: number; // 0..1
  evidenceIds: string[];
  riskScore?: number;
  networkRisk?: number;
  suspiciousExposure?: number;
}

export interface RiskEscalatedEvent {
  eventId: string;
  analysisRunId: string;
  providerId: string;
  previousRisk: number;
  currentRisk: number;
  change: number;
  thresholdCrossed?: number;
  evidenceIds: string[];
  timestamp: string;
}

export interface NetworkRiskChangedEvent {
  eventId: string;
  analysisRunId: string;
  networkId: string;
  previousRisk: number;
  currentRisk: number;
  change: number;
  connectedProviders: number;
  referralRelationships: number;
  timestamp: string;
}

/* ---------- Investigator ---------- */

export interface InvestigatorNotificationPreferences {
  criticalAnomaly: boolean;
  newCase: boolean;
  riskEscalation: boolean;
  networkEscalation: boolean;
}

export interface Investigator {
  investigatorId: string;
  name: string;
  role: string;
  phoneNumber: string;
  whatsappEnabled: boolean;
  active: boolean;
  notificationPreferences: InvestigatorNotificationPreferences;
  /** Duty officer receives alerts for unassigned cases. */
  isDutyOfficer?: boolean;
}

/* ---------- Alert policy ---------- */

export interface WhatsAppAlertPolicy {
  enabled: boolean;
  minimumSeverity: Severity;
  minimumConfidence: number; // 0..1
  minimumRiskScore: number;
  notifyOnNewCase: boolean;
  notifyOnCriticalAnomaly: boolean;
  notifyOnRiskEscalation: boolean;
  notifyOnNetworkEscalation: boolean;
  cooldownMinutes: number;
  /** Risk escalation only alerts when the jump meets or exceeds this delta. */
  riskEscalationMinChange: number;
  /** Network escalation alerts when network risk reaches this level. */
  networkEscalationThreshold: number;
}

/* ---------- Case snapshot (what the backend reasons over) ---------- */

export interface CaseSnapshot {
  caseId: string;
  providerId: string;
  providerName: string;
  specialty?: string;
  status: string;
  riskScore: number;
  evidenceStrength: number; // percent
  confidence: number; // 0..1
  severity: Severity;
  estimatedExposure: number;
  networkId?: string;
  networkRiskScore: number;
  evidenceCount: number;
  detectorTypeCount: number;
  affectedMembersCount: number;
  assignedInvestigatorId?: string;
  evidenceIds: string[];
  anomalyType: string;
  shortReason: string;
}

export interface NetworkSnapshot {
  networkId: string;
  riskScore: number;
  connectedProviders: number;
  referralRelationships: number;
}

export interface AnalysisSnapshotPayload {
  analysisRunId: string;
  cases: CaseSnapshot[];
  networks: NetworkSnapshot[];
}

/* ---------- Outbound messages ---------- */

export interface InvestigatorAlert {
  notificationId: string;
  eventType: NotificationEventType;
  caseId: string;
  anomalyId: string;
  investigator: Investigator;
  templateName: string;
  variables: Record<string, string>;
  bodyText: string;
  caseUrl: string;
}

export interface CaseNotification {
  notificationId: string;
  caseId: string;
  investigator: Investigator;
  title: string;
  bodyText: string;
  caseUrl: string;
}

export interface DeliveryResult {
  success: boolean;
  providerMessageId?: string;
  status: DeliveryStatus;
  error?: string;
  latencyMs?: number;
  raw?: unknown;
}

/* ---------- Persisted notification record ---------- */

export interface NotificationRecord {
  notificationId: string;
  dedupKey: string;
  eventId: string;
  anomalyId: string;
  caseId: string;
  providerId?: string;
  networkId?: string;
  investigatorId: string;
  investigatorName: string;
  notificationType: NotificationEventType;
  templateName: string;
  bodyText: string;
  caseUrl: string;
  status: DeliveryStatus;
  retryCount: number;
  providerMessageId?: string;
  lastError?: string;
  latencyMs?: number;
  createdAt: string;
  updatedAt: string;
  /** Status transitions for the audit/case history timeline. */
  history: { status: DeliveryStatus; at: string; note?: string }[];
  read: boolean;
  /** True when routed to the unassigned queue (no investigator). */
  unassigned: boolean;
}

/* ---------- Event -> default notification matrix (Section 30) ---------- */

export const EVENT_DEFAULT_WHATSAPP: Record<NotificationEventType, boolean> = {
  ANOMALY_DETECTED: false,
  HIGH_SEVERITY_ANOMALY: true,
  SIU_CASE_CREATED: true,
  RISK_ESCALATED: true, // only "major" escalations pass the policy delta
  NETWORK_RISK_ESCALATED: true, // only when threshold crossed
  CASE_ASSIGNED: false,
  INVESTIGATION_DEADLINE_APPROACHING: false,
};
