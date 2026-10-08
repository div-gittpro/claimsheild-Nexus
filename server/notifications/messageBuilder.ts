import {
  AnomalyDetectedEvent,
  CaseSnapshot,
  InvestigatorAlert,
  Investigator,
  NetworkRiskChangedEvent,
  NotificationEventType,
  RiskEscalatedEvent,
} from './types';

/**
 * Builds the minimal, privacy-safe WhatsApp alert content (Sections 9-12, 27-28).
 *
 * Rules enforced here:
 *  - No PHI (no patient names / diagnoses / treatment / member clinical detail).
 *  - Human-in-the-loop language ("potential FWA pattern", never "committed fraud").
 *  - Minimum necessary info + a deep link to the secure Case Workbench.
 */

export const ALERT_TEMPLATE_NAME = process.env.WHATSAPP_ALERT_TEMPLATE || 'claimshield_anomaly_alert';

function appBaseUrl(): string {
  return (process.env.APP_URL || 'https://claimshield.nexus').replace(/\/$/, '');
}

/** Deep link that lands directly on the Case Workbench (Section 12). */
export function caseDeepLink(caseId: string): string {
  return `${appBaseUrl()}/investigations/${caseId}`;
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface BuiltMessage {
  templateName: string;
  variables: Record<string, string>;
  bodyText: string;
  caseUrl: string;
}

/** Primary anomaly / new-case alert. */
export function buildAnomalyMessage(event: AnomalyDetectedEvent, c: CaseSnapshot): BuiltMessage {
  const caseUrl = caseDeepLink(c.caseId);
  const variables: Record<string, string> = {
    case_id: c.caseId,
    provider_id: c.providerId,
    anomaly_type: c.anomalyType,
    risk_score: String(c.riskScore),
    confidence: c.confidence.toFixed(2),
    exposure: fmtMoney(c.estimatedExposure),
    short_reason: c.shortReason,
    timestamp: fmtTimestamp(event.timestamp),
    case_url: caseUrl,
  };

  const bodyText = [
    '🚨 ClaimShield Nexus Alert',
    '',
    `${event.severity === 'CRITICAL' ? 'Critical' : 'High'}-severity anomaly detected.`,
    '',
    `Case: ${c.caseId}`,
    `Provider: ${c.providerId}`,
    `Anomaly: ${c.anomalyType}`,
    '',
    `Risk: ${c.riskScore}`,
    `Confidence: ${c.confidence.toFixed(2)}`,
    `Exposure: ${fmtMoney(c.estimatedExposure)}`,
    '',
    'Why it matters:',
    c.shortReason,
    '',
    `Detected: ${fmtTimestamp(event.timestamp)}`,
    '',
    `Open investigation: ${caseUrl}`,
  ].join('\n');

  return { templateName: ALERT_TEMPLATE_NAME, variables, bodyText, caseUrl };
}

export function buildRiskEscalationMessage(event: RiskEscalatedEvent, c?: CaseSnapshot): BuiltMessage {
  const caseId = c?.caseId || event.providerId;
  const caseUrl = c ? caseDeepLink(c.caseId) : appBaseUrl();
  const variables: Record<string, string> = {
    provider_id: event.providerId,
    previous_risk: String(event.previousRisk),
    current_risk: String(event.currentRisk),
    change: `${event.change >= 0 ? '+' : ''}${event.change}`,
    case_url: caseUrl,
  };
  const bodyText = [
    '🚨 ClaimShield Nexus — Risk escalation',
    '',
    `Provider ${event.providerId} crossed the SIU threshold.`,
    '',
    `Previous risk: ${event.previousRisk}`,
    `Current risk: ${event.currentRisk}`,
    `Change: ${event.change >= 0 ? '+' : ''}${event.change}`,
    '',
    'Potential FWA pattern — human review required.',
    '',
    `Open investigation: ${caseUrl}`,
  ].join('\n');
  void caseId;
  return { templateName: ALERT_TEMPLATE_NAME, variables, bodyText, caseUrl };
}

export function buildNetworkEscalationMessage(event: NetworkRiskChangedEvent): BuiltMessage {
  const caseUrl = `${appBaseUrl()}/networks/${event.networkId}`;
  const variables: Record<string, string> = {
    network_id: event.networkId,
    network_risk: String(event.currentRisk),
    connected_providers: String(event.connectedProviders),
    referral_relationships: String(event.referralRelationships),
    case_url: caseUrl,
  };
  const bodyText = [
    '🚨 ClaimShield Nexus — Network escalation',
    '',
    `Network ${event.networkId} has reached elevated risk.`,
    '',
    `Network Risk: ${event.currentRisk}`,
    `Connected providers: ${event.connectedProviders}`,
    `Referral relationships: ${event.referralRelationships}`,
    '',
    'Review network intelligence. Network association does not establish wrongdoing.',
    '',
    `Open: ${caseUrl}`,
  ].join('\n');
  return { templateName: ALERT_TEMPLATE_NAME, variables, bodyText, caseUrl };
}

export function toInvestigatorAlert(
  notificationId: string,
  eventType: NotificationEventType,
  caseId: string,
  anomalyId: string,
  investigator: Investigator,
  built: BuiltMessage,
): InvestigatorAlert {
  return {
    notificationId,
    eventType,
    caseId,
    anomalyId,
    investigator,
    templateName: built.templateName,
    variables: built.variables,
    bodyText: built.bodyText,
    caseUrl: built.caseUrl,
  };
}
