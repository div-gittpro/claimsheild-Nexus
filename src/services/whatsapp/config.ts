/**
 * Centralized WhatsApp alert configuration.
 *
 * Both the eligibility policy and the message template live here so the rules
 * exist in exactly one place and are reused by every entry point (Case
 * Workbench, SIU Queue, Overview). This is the UI notification policy and is
 * intentionally separate from the backend SIU/alerting pipeline.
 */

export interface WhatsAppAlertPolicy {
  enabled: boolean;
  minimumRiskScore: number;
  minimumEvidenceStrength: number;
}

export const WHATSAPP_ALERT_POLICY: WhatsAppAlertPolicy = {
  enabled: true,
  minimumRiskScore: 70,
  minimumEvidenceStrength: 50,
};

/** Variables available to the single message template. */
export interface WhatsAppTemplateVars {
  caseId: string;
  providerId: string;
  riskScore: number | string;
  evidenceStrength: number | string;
  signalCount: number | string;
  exposure: string;
  primaryReason: string;
  caseUrl: string;
}

/**
 * The ONE canonical message template. Keep it short, metadata-only, and free of
 * PHI (Section 9) — the detailed evidence stays inside ClaimShield.
 */
export const WHATSAPP_MESSAGE_TEMPLATE = `🚨 ClaimShield Nexus — SIU Alert

Case: {{caseId}}
Provider: {{providerId}}
Risk Score: {{riskScore}}
Evidence Strength: {{evidenceStrength}}%
Signals: {{signalCount}}
Suspicious Exposure: {{exposure}}

Reason:
{{primaryReason}}

Open Case:
{{caseUrl}}`;

/** Fill the template with case values. Defined once; never reconstructed elsewhere. */
export function renderWhatsAppMessage(vars: WhatsAppTemplateVars): string {
  return WHATSAPP_MESSAGE_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, key: keyof WhatsAppTemplateVars) => {
    const value = vars[key as keyof WhatsAppTemplateVars];
    return value === undefined || value === null ? '' : String(value);
  });
}
