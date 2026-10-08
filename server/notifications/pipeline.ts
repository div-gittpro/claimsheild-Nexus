import {
  AnalysisSnapshotPayload,
  AnomalyDetectedEvent,
  CaseSnapshot,
  Investigator,
  NetworkRiskChangedEvent,
  NotificationEventType,
  NotificationRecord,
  RiskEscalatedEvent,
} from './types';
import {
  evaluateAnomaly,
  evaluateNetworkEscalation,
  evaluateRiskEscalation,
} from './alertPolicy';
import { notificationStore } from './store';
import {
  buildAnomalyMessage,
  buildNetworkEscalationMessage,
  buildRiskEscalationMessage,
} from './messageBuilder';
import { whatsappQueue } from '../workers/whatsappAlertWorker';

/**
 * Event bus + pipeline orchestration (Sections 1, 13-16, 31-32, 37).
 *
 * The frontend posts a lightweight analysis snapshot after each run. This module
 * derives domain events, applies the alert policy (notification eligibility,
 * which is distinct from SIU eligibility), resolves the responsible investigator,
 * enforces deduplication + cooldown, then enqueues the notification. It never
 * blocks the caller on WhatsApp and never mutates the analytical source of truth.
 */

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface PipelineResult {
  evaluated: number;
  queued: number;
  suppressed: { caseId: string; reason: string }[];
}

/**
 * Resolve the investigator to notify. If a case has no assignee, route to the
 * SIU duty officer and flag the record as unassigned (Section 6). We never pick
 * a random investigator.
 */
function resolveInvestigator(c: CaseSnapshot): { investigator?: Investigator; unassigned: boolean } {
  const assigned = notificationStore.getInvestigator(c.assignedInvestigatorId);
  if (assigned && assigned.active) return { investigator: assigned, unassigned: false };
  const duty = notificationStore.getDutyOfficer();
  return { investigator: duty, unassigned: true };
}

function investigatorAccepts(inv: Investigator, eventType: NotificationEventType): boolean {
  if (!inv.whatsappEnabled || !inv.active) return false;
  const p = inv.notificationPreferences;
  switch (eventType) {
    case 'HIGH_SEVERITY_ANOMALY':
      // Mandatory critical notifications cannot be disabled (Section 26).
      return true;
    case 'SIU_CASE_CREATED':
      return p.newCase;
    case 'RISK_ESCALATED':
      return p.riskEscalation;
    case 'NETWORK_RISK_ESCALATED':
      return p.networkEscalation;
    default:
      return true;
  }
}

function enqueueNotification(params: {
  eventId: string;
  anomalyId: string;
  analysisRunId: string;
  eventType: NotificationEventType;
  caseId: string;
  providerId?: string;
  networkId?: string;
  investigator: Investigator;
  unassigned: boolean;
  templateName: string;
  bodyText: string;
  caseUrl: string;
  cooldownSubject: string;
}): { queued: boolean; reason?: string } {
  const policy = notificationStore.getPolicy();
  const dedupKey = `${params.analysisRunId}:${params.anomalyId}:${params.investigator.investigatorId}`;

  // Deduplication (Section 13).
  if (notificationStore.hasDedup(dedupKey)) {
    notificationStore.bump('duplicatesPrevented');
    return { queued: false, reason: 'Duplicate suppressed (dedup key already seen).' };
  }

  // Cooldown (Section 14).
  const remaining = notificationStore.cooldownRemainingMs(params.cooldownSubject, policy.cooldownMinutes);
  if (remaining > 0) {
    notificationStore.bump('cooldownSuppressed');
    return { queued: false, reason: `Cooldown active (${Math.ceil(remaining / 60000)}m remaining).` };
  }

  // Preference gate.
  if (!investigatorAccepts(params.investigator, params.eventType)) {
    return { queued: false, reason: 'Investigator preference opted out of this event type.' };
  }

  const now = new Date().toISOString();
  const notificationId = uid('ntf');
  const rec: NotificationRecord = {
    notificationId,
    dedupKey,
    eventId: params.eventId,
    anomalyId: params.anomalyId,
    caseId: params.caseId,
    providerId: params.providerId,
    networkId: params.networkId,
    investigatorId: params.investigator.investigatorId,
    investigatorName: params.investigator.name,
    notificationType: params.eventType,
    templateName: params.templateName,
    bodyText: params.bodyText,
    caseUrl: params.caseUrl,
    status: 'QUEUED',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    history: [{ status: 'QUEUED', at: now }],
    read: false,
    unassigned: params.unassigned,
  };

  notificationStore.saveNotification(rec);
  notificationStore.addDedup(dedupKey);
  notificationStore.stampCooldown(params.cooldownSubject);
  notificationStore.bump('alertsGenerated');
  notificationStore.addAudit({
    eventType: 'WHATSAPP_ALERT_QUEUED',
    caseId: params.caseId,
    anomalyId: params.anomalyId,
    investigatorId: params.investigator.investigatorId,
    notificationId,
    templateName: params.templateName,
    deliveryStatus: 'QUEUED',
    details: `${params.eventType} queued for ${params.investigator.name}${params.unassigned ? ' (unassigned → duty officer)' : ''}.`,
  });

  whatsappQueue.enqueue(
    {
      notificationId,
      eventType: params.eventType,
      caseId: params.caseId,
      anomalyId: params.anomalyId,
      investigator: params.investigator,
    },
    'alert',
  );

  return { queued: true };
}

/**
 * Ingest an analysis snapshot and run the full event-driven evaluation.
 * This is the single entry point called by the backend after a run completes.
 */
export function ingestAnalysisSnapshot(payload: AnalysisSnapshotPayload): PipelineResult {
  const result: PipelineResult = { evaluated: 0, queued: 0, suppressed: [] };
  const policy = notificationStore.getPolicy();
  notificationStore.resetForRun(payload.analysisRunId);

  for (const c of payload.cases) {
    result.evaluated += 1;
    const anomalyId = `anom_${c.caseId}`;
    const nowIso = new Date().toISOString();

    // Derive the AnomalyDetectedEvent from the case snapshot.
    const anomalyEvent: AnomalyDetectedEvent = {
      eventId: uid('evt'),
      analysisRunId: payload.analysisRunId,
      timestamp: nowIso,
      anomalyId,
      providerId: c.providerId,
      anomalyType: c.anomalyType,
      severity: c.severity,
      confidence: c.confidence,
      evidenceIds: c.evidenceIds,
      riskScore: c.riskScore,
      networkRisk: c.networkRiskScore,
      suspiciousExposure: c.estimatedExposure,
    };

    // --- Risk escalation detection against the stored baseline (Section 15) ---
    const prevRisk = notificationStore.getProviderBaseline(c.providerId);
    if (prevRisk !== undefined && c.riskScore > prevRisk) {
      const escalation: RiskEscalatedEvent = {
        eventId: uid('evt'),
        analysisRunId: payload.analysisRunId,
        providerId: c.providerId,
        previousRisk: prevRisk,
        currentRisk: c.riskScore,
        change: c.riskScore - prevRisk,
        thresholdCrossed: policy.minimumRiskScore,
        evidenceIds: c.evidenceIds,
        timestamp: nowIso,
      };
      const decision = evaluateRiskEscalation(escalation, policy);
      if (decision.eligible) {
        const { investigator, unassigned } = resolveInvestigator(c);
        if (investigator) {
          const msg = buildRiskEscalationMessage(escalation, c);
          const r = enqueueNotification({
            eventId: escalation.eventId,
            anomalyId: `risk_${c.providerId}_${escalation.currentRisk}`,
            analysisRunId: payload.analysisRunId,
            eventType: 'RISK_ESCALATED',
            caseId: c.caseId,
            providerId: c.providerId,
            investigator,
            unassigned,
            templateName: msg.templateName,
            bodyText: msg.bodyText,
            caseUrl: msg.caseUrl,
            cooldownSubject: `risk:${c.providerId}:${investigator.investigatorId}`,
          });
          if (r.queued) result.queued += 1;
          else if (r.reason) result.suppressed.push({ caseId: c.caseId, reason: r.reason });
        }
      } else {
        result.suppressed.push({ caseId: c.caseId, reason: decision.reason });
      }
    }
    notificationStore.setProviderBaseline(c.providerId, c.riskScore);

    // --- New-case / anomaly alert (only for cases not seen in a prior run) ---
    const seenKey = `${payload.analysisRunId}:${c.caseId}`;
    const alreadySeen = notificationStore.markCaseSeen(seenKey);
    if (!alreadySeen) {
      const decision = evaluateAnomaly(anomalyEvent, c, policy);
      if (decision.eligible) {
        const { investigator, unassigned } = resolveInvestigator(c);
        if (investigator) {
          const msg = buildAnomalyMessage(anomalyEvent, c);
          const r = enqueueNotification({
            eventId: anomalyEvent.eventId,
            anomalyId,
            analysisRunId: payload.analysisRunId,
            eventType: decision.eventType,
            caseId: c.caseId,
            providerId: c.providerId,
            investigator,
            unassigned,
            templateName: msg.templateName,
            bodyText: msg.bodyText,
            caseUrl: msg.caseUrl,
            cooldownSubject: `case:${c.caseId}:${investigator.investigatorId}`,
          });
          if (r.queued) result.queued += 1;
          else if (r.reason) result.suppressed.push({ caseId: c.caseId, reason: r.reason });
        } else {
          result.suppressed.push({ caseId: c.caseId, reason: 'No investigator or duty officer available.' });
        }
      } else {
        result.suppressed.push({ caseId: c.caseId, reason: decision.reason });
      }
    }
  }

  // --- Network escalation (Section 16) ---
  for (const net of payload.networks) {
    const prev = notificationStore.getNetworkBaseline(net.networkId);
    if (prev !== undefined && net.riskScore > prev) {
      const event: NetworkRiskChangedEvent = {
        eventId: uid('evt'),
        analysisRunId: payload.analysisRunId,
        networkId: net.networkId,
        previousRisk: prev,
        currentRisk: net.riskScore,
        change: net.riskScore - prev,
        connectedProviders: net.connectedProviders,
        referralRelationships: net.referralRelationships,
        timestamp: new Date().toISOString(),
      };
      const decision = evaluateNetworkEscalation(event, policy);
      if (decision.eligible) {
        const duty = notificationStore.getDutyOfficer();
        if (duty) {
          const msg = buildNetworkEscalationMessage(event);
          const r = enqueueNotification({
            eventId: event.eventId,
            anomalyId: `net_${net.networkId}_${net.riskScore}`,
            analysisRunId: payload.analysisRunId,
            eventType: 'NETWORK_RISK_ESCALATED',
            caseId: net.networkId,
            networkId: net.networkId,
            investigator: duty,
            unassigned: false,
            templateName: msg.templateName,
            bodyText: msg.bodyText,
            caseUrl: msg.caseUrl,
            cooldownSubject: `net:${net.networkId}:${duty.investigatorId}`,
          });
          if (r.queued) result.queued += 1;
          else if (r.reason) result.suppressed.push({ caseId: net.networkId, reason: r.reason });
        }
      } else {
        result.suppressed.push({ caseId: net.networkId, reason: decision.reason });
      }
    }
    notificationStore.setNetworkBaseline(net.networkId, net.riskScore);
  }

  return result;
}
