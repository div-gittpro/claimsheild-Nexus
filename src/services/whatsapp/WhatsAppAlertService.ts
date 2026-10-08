import { CaseRecord } from '../../types';
import {
  WHATSAPP_ALERT_POLICY,
  WhatsAppAlertPolicy,
  renderWhatsAppMessage,
  WhatsAppTemplateVars,
} from './config';
import {
  WhatsAppProvider,
  WhatsAppRedirectService,
  WhatsAppDeliveryStatus,
  normalizePhone,
} from './provider';

/**
 * Central WhatsApp alert service (Section 13).
 *
 * Responsibilities: eligibility check, message generation from the single
 * template, encoding, URL generation, opening WhatsApp, and returning a
 * PREPARED status. Reused by the Case Workbench, SIU Queue and Overview — the
 * message is never constructed anywhere else.
 */

export interface WhatsAppEligibility {
  eligible: boolean;
  reason: string;
}

export interface WhatsAppAlert {
  caseId: string;
  recipient?: string;
  recipientLabel: string;
  message: string;
  url: string;
  status: WhatsAppDeliveryStatus;
  preparedAt: string;
}

/** Minimal case shape the service needs — mapped from the canonical CaseRecord. */
export interface WhatsAppCaseInput {
  caseId: string;
  providerId: string;
  riskScore: number;
  evidenceStrength: number;
  signalCount: number;
  exposure: number;
  primaryReason: string;
  investigatorPhone?: string;
}

function appBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://claimshield.nexus';
}

/** Deep link that lands on the Case Workbench (reused by the backend route too). */
export function caseDeepLink(caseId: string): string {
  return `${appBaseUrl()}/investigations/${caseId}`;
}

/** Short, PHI-free reason derived from case analytics. */
export function derivePrimaryReason(input: { signalCount: number; detectorTypes?: number; networkRisk?: number }): string {
  const detectors = input.detectorTypes ?? 0;
  const base = detectors > 1
    ? `${input.signalCount} signals across ${detectors} detector types`
    : `${input.signalCount} corroborating signals`;
  const network = (input.networkRisk ?? 0) >= 80 ? ' with elevated network exposure' : '';
  return `High-risk FWA pattern requiring SIU investigation — ${base}${network}.`;
}

/** Map a canonical CaseRecord into the service input (no PHI). */
export function caseToWhatsAppInput(c: CaseRecord, investigatorPhone?: string): WhatsAppCaseInput {
  const detectorTypes = c.evidenceTypes?.length || new Set(c.evidenceBreakdown.map((e) => e.ruleName)).size;
  return {
    caseId: c.id,
    providerId: c.targetId,
    riskScore: c.riskScore,
    evidenceStrength: c.evidenceStrength,
    signalCount: c.evidenceBreakdown.length,
    exposure: c.estimatedExposure,
    primaryReason: derivePrimaryReason({ signalCount: c.evidenceBreakdown.length, detectorTypes, networkRisk: c.networkRiskScore }),
    investigatorPhone,
  };
}

function formatExposure(amount: number): string {
  // Rupee formatting per the spec examples (₹118,553).
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function maskPhone(normalized?: string): string {
  if (!normalized) return 'No saved number — choose a chat in WhatsApp';
  const tail = normalized.slice(-5);
  const head = normalized.slice(0, Math.max(0, normalized.length - 5)).replace(/\d/g, 'X');
  return `+${head} ${tail}`.trim();
}

export class WhatsAppAlertService {
  constructor(
    private readonly provider: WhatsAppProvider = new WhatsAppRedirectService(),
    private readonly policy: WhatsAppAlertPolicy = WHATSAPP_ALERT_POLICY,
  ) {}

  /** Centralized eligibility (Section 3). */
  checkEligibility(input: Pick<WhatsAppCaseInput, 'riskScore' | 'evidenceStrength'>): WhatsAppEligibility {
    if (!this.policy.enabled) {
      return { eligible: false, reason: 'WhatsApp alerts are disabled.' };
    }
    if (input.riskScore < this.policy.minimumRiskScore || input.evidenceStrength < this.policy.minimumEvidenceStrength) {
      return { eligible: false, reason: 'Case does not meet WhatsApp alert criteria.' };
    }
    return { eligible: true, reason: 'Case meets the WhatsApp alert criteria.' };
  }

  /** Build the full alert (message + URL) without opening WhatsApp. */
  prepareAlert(input: WhatsAppCaseInput): WhatsAppAlert {
    const vars: WhatsAppTemplateVars = {
      caseId: input.caseId,
      providerId: input.providerId,
      riskScore: input.riskScore,
      evidenceStrength: input.evidenceStrength,
      signalCount: input.signalCount,
      exposure: formatExposure(input.exposure),
      primaryReason: input.primaryReason,
      caseUrl: caseDeepLink(input.caseId),
    };
    const message = renderWhatsAppMessage(vars);
    const recipient = normalizePhone(input.investigatorPhone);
    const url = this.provider.buildUrl(message, recipient);
    return {
      caseId: input.caseId,
      recipient,
      recipientLabel: maskPhone(recipient),
      message,
      url,
      status: 'PREPARED',
      preparedAt: new Date().toISOString(),
    };
  }

  /** Open WhatsApp for a previously prepared alert. Returns the (prepared) status. */
  open(alert: WhatsAppAlert): WhatsAppDeliveryStatus {
    return this.provider.dispatch({ recipient: alert.recipient, message: alert.message, url: alert.url });
  }
}

/** Shared singleton used across the UI. */
export const whatsAppAlertService = new WhatsAppAlertService();
