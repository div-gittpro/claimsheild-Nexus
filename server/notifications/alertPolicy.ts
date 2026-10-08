import {
  AnomalyDetectedEvent,
  CaseSnapshot,
  EVENT_DEFAULT_WHATSAPP,
  NetworkRiskChangedEvent,
  NotificationEventType,
  RiskEscalatedEvent,
  SEVERITY_RANK,
  Severity,
  WhatsAppAlertPolicy,
} from './types';

/**
 * Alert policy engine.
 *
 * Section 5 of the spec: notification eligibility is a SEPARATE concept from SIU
 * case eligibility. A case can be SIU-eligible without being alert-worthy, and a
 * critical/high-confidence anomaly can alert even when it would be a lower SIU
 * priority. This module encodes only the notification decision.
 */

export const DEFAULT_POLICY: WhatsAppAlertPolicy = {
  enabled: true,
  minimumSeverity: 'HIGH',
  minimumConfidence: 0.8,
  minimumRiskScore: 75,
  notifyOnNewCase: true,
  notifyOnCriticalAnomaly: true,
  notifyOnRiskEscalation: true,
  notifyOnNetworkEscalation: true,
  cooldownMinutes: 60,
  riskEscalationMinChange: 5,
  networkEscalationThreshold: 80,
};

export interface EligibilityDecision {
  eligible: boolean;
  reason: string;
  eventType: NotificationEventType;
}

function severityMeets(severity: Severity, minimum: Severity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[minimum];
}

/**
 * Decide whether an anomaly / newly created SIU case should alert.
 * Critical anomalies with sufficient confidence bypass the risk-score floor
 * (Section 5: Severity CRITICAL + high confidence triggers an immediate alert).
 */
export function evaluateAnomaly(
  event: AnomalyDetectedEvent,
  caseSnapshot: CaseSnapshot | undefined,
  policy: WhatsAppAlertPolicy,
): EligibilityDecision {
  if (!policy.enabled) {
    return { eligible: false, reason: 'WhatsApp notifications disabled by policy.', eventType: 'ANOMALY_DETECTED' };
  }

  const isCritical = event.severity === 'CRITICAL';
  const eventType: NotificationEventType = isCritical
    ? 'HIGH_SEVERITY_ANOMALY'
    : caseSnapshot
      ? 'SIU_CASE_CREATED'
      : 'ANOMALY_DETECTED';

  // Matrix default gate (Section 30).
  if (!EVENT_DEFAULT_WHATSAPP[eventType]) {
    return { eligible: false, reason: `Event ${eventType} is not alert-worthy by default.`, eventType };
  }

  // Critical fast-path.
  if (isCritical) {
    if (!policy.notifyOnCriticalAnomaly) {
      return { eligible: false, reason: 'Critical-anomaly alerts disabled by policy.', eventType };
    }
    if (event.confidence < policy.minimumConfidence) {
      return {
        eligible: false,
        reason: `Confidence ${event.confidence.toFixed(2)} below minimum ${policy.minimumConfidence}.`,
        eventType,
      };
    }
    return { eligible: true, reason: 'Critical anomaly with sufficient confidence.', eventType };
  }

  // New SIU case path.
  if (eventType === 'SIU_CASE_CREATED') {
    if (!policy.notifyOnNewCase) {
      return { eligible: false, reason: 'New-case alerts disabled by policy.', eventType };
    }
    if (!severityMeets(event.severity, policy.minimumSeverity)) {
      return { eligible: false, reason: `Severity ${event.severity} below minimum ${policy.minimumSeverity}.`, eventType };
    }
    if (event.confidence < policy.minimumConfidence) {
      return { eligible: false, reason: `Confidence ${event.confidence.toFixed(2)} below minimum ${policy.minimumConfidence}.`, eventType };
    }

    // Multi-detector corroboration fast-path (Sections 5, 10): several independent
    // detector types plus high confidence and elevated network exposure escalate a
    // sub-floor case into an alert-worthy high-severity anomaly. A lone risk-72 case
    // with weak corroboration still does NOT alert (preserving the Section 5 distinction).
    const corroborated =
      (caseSnapshot?.detectorTypeCount ?? 0) >= 3 &&
      event.confidence >= policy.minimumConfidence &&
      (event.networkRisk ?? 0) >= policy.networkEscalationThreshold - 10;

    if ((event.riskScore ?? 0) < policy.minimumRiskScore) {
      if (corroborated) {
        return {
          eligible: true,
          reason: 'Multiple corroborating detector types with high confidence and elevated network exposure.',
          eventType: 'HIGH_SEVERITY_ANOMALY',
        };
      }
      return { eligible: false, reason: `Risk ${event.riskScore ?? 0} below minimum ${policy.minimumRiskScore}.`, eventType };
    }
    return { eligible: true, reason: 'New SIU case meets severity, confidence and risk floors.', eventType };
  }

  return { eligible: false, reason: 'Low/medium anomaly — stored and monitored, no alert.', eventType };
}

export function evaluateRiskEscalation(
  event: RiskEscalatedEvent,
  policy: WhatsAppAlertPolicy,
): EligibilityDecision {
  const eventType: NotificationEventType = 'RISK_ESCALATED';
  if (!policy.enabled || !policy.notifyOnRiskEscalation) {
    return { eligible: false, reason: 'Risk-escalation alerts disabled by policy.', eventType };
  }
  // "Major" escalation only: change must meet the configured delta...
  if (event.change < policy.riskEscalationMinChange) {
    return { eligible: false, reason: `Risk change +${event.change} below minimum +${policy.riskEscalationMinChange}.`, eventType };
  }
  // ...and the escalation must cross the SIU risk floor (not a small 72->73 wobble).
  const crossedFloor = event.previousRisk < policy.minimumRiskScore && event.currentRisk >= policy.minimumRiskScore;
  const bigJump = event.change >= policy.riskEscalationMinChange * 2;
  if (!crossedFloor && !bigJump) {
    return { eligible: false, reason: 'Escalation did not cross the SIU threshold or constitute a major jump.', eventType };
  }
  return { eligible: true, reason: crossedFloor ? 'Provider crossed the SIU risk threshold.' : 'Major risk escalation.', eventType };
}

export function evaluateNetworkEscalation(
  event: NetworkRiskChangedEvent,
  policy: WhatsAppAlertPolicy,
): EligibilityDecision {
  const eventType: NotificationEventType = 'NETWORK_RISK_ESCALATED';
  if (!policy.enabled || !policy.notifyOnNetworkEscalation) {
    return { eligible: false, reason: 'Network-escalation alerts disabled by policy.', eventType };
  }
  const crossed = event.previousRisk < policy.networkEscalationThreshold && event.currentRisk >= policy.networkEscalationThreshold;
  if (!crossed) {
    return { eligible: false, reason: `Network risk ${event.currentRisk} did not newly cross ${policy.networkEscalationThreshold}.`, eventType };
  }
  return { eligible: true, reason: `Network reached elevated risk (${event.currentRisk}).`, eventType };
}
