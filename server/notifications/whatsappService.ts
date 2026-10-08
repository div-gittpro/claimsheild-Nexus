import { CaseNotification, DeliveryResult, InvestigatorAlert } from './types';

/**
 * Provider-agnostic WhatsApp service (Section 7).
 *
 * The anomaly engine only depends on this interface, so the provider can be
 * swapped (Meta Cloud API, Twilio, etc.) without touching detection logic.
 * Credentials live only on the server, read from environment variables.
 */
export interface WhatsAppService {
  readonly mode: 'mock' | 'live';
  sendAlert(alert: InvestigatorAlert): Promise<DeliveryResult>;
  sendCaseNotification(notification: CaseNotification): Promise<DeliveryResult>;
}

function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Mock provider for development / hackathon demo (Section 35, WHATSAPP_MODE=mock).
 * Simulates a successful send without calling the real API.
 */
export class MockWhatsAppService implements WhatsAppService {
  readonly mode = 'mock' as const;

  private simulate(toPhone: string): DeliveryResult {
    const providerMessageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:mock] simulated send to ${sanitizePhone(toPhone)} (${providerMessageId})`);
    return { success: true, providerMessageId, status: 'SENT', latencyMs: 5 };
  }

  async sendAlert(alert: InvestigatorAlert): Promise<DeliveryResult> {
    return this.simulate(alert.investigator.phoneNumber);
  }

  async sendCaseNotification(notification: CaseNotification): Promise<DeliveryResult> {
    return this.simulate(notification.investigator.phoneNumber);
  }
}

/**
 * Live provider using the Meta WhatsApp Cloud API (Section 7-8).
 * Sends a text message via the Graph API. In production this would use an
 * approved message template; we send the pre-rendered body text here and keep
 * the template name in the audit trail.
 */
export class MetaWhatsAppService implements WhatsAppService {
  readonly mode = 'live' as const;

  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  private readonly apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  private configured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  private async send(toPhone: string, bodyText: string): Promise<DeliveryResult> {
    const start = Date.now();
    if (!this.configured()) {
      return { success: false, status: 'FAILED', error: 'WhatsApp live provider not configured (missing token or phone number id).' };
    }
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: sanitizePhone(toPhone),
          type: 'text',
          text: { preview_url: true, body: bodyText },
        }),
      });
      const latencyMs = Date.now() - start;
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          status: res.status >= 500 || res.status === 429 ? 'RETRYING' : 'FAILED',
          error: data?.error?.message || `HTTP ${res.status}`,
          latencyMs,
          raw: data,
        };
      }
      const providerMessageId = data?.messages?.[0]?.id;
      return { success: true, providerMessageId, status: 'SENT', latencyMs, raw: data };
    } catch (err: any) {
      return { success: false, status: 'RETRYING', error: err?.message || 'Network error', latencyMs: Date.now() - start };
    }
  }

  async sendAlert(alert: InvestigatorAlert): Promise<DeliveryResult> {
    return this.send(alert.investigator.phoneNumber, alert.bodyText);
  }

  async sendCaseNotification(notification: CaseNotification): Promise<DeliveryResult> {
    return this.send(notification.investigator.phoneNumber, notification.bodyText);
  }
}

let singleton: WhatsAppService | null = null;

/** Resolve the configured provider. Defaults to mock unless WHATSAPP_MODE=live. */
export function getWhatsAppService(): WhatsAppService {
  if (singleton) return singleton;
  const mode = (process.env.WHATSAPP_MODE || 'mock').toLowerCase();
  const provider = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();
  if (mode === 'live' && provider === 'meta') {
    singleton = new MetaWhatsAppService();
  } else {
    singleton = new MockWhatsAppService();
  }
  return singleton;
}
