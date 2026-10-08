/**
 * WhatsApp provider abstraction.
 *
 * The UI depends only on this interface, so the redirect (wa.me) provider used
 * today can later be replaced by a MetaWhatsAppService that calls the Cloud API
 * — without changing any SIU UI code (Section 15):
 *
 *   UI → WhatsAppAlertService → WhatsAppProvider → (wa.me | Meta Cloud API)
 */

export type WhatsAppDeliveryStatus = 'PREPARED' | 'OPENED' | 'SENT' | 'DELIVERED' | 'FAILED';

export interface PreparedWhatsAppMessage {
  recipient?: string; // normalized phone (optional for wa.me)
  message: string;
  url: string;
}

export interface WhatsAppProvider {
  readonly kind: 'redirect' | 'meta';
  /** Build the provider-specific URL for a message. */
  buildUrl(message: string, recipient?: string): string;
  /** Trigger the message. For the redirect provider this opens WhatsApp. */
  dispatch(prepared: PreparedWhatsAppMessage): WhatsAppDeliveryStatus;
}

/** Normalize a phone number to digits only (wa.me requires no +, spaces or dashes). */
export function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 7 ? digits : undefined;
}

/**
 * Redirect provider — opens WhatsApp (web/app) with a pre-filled message via the
 * deep-link mechanism. No API, no credentials, no background sending. The
 * investigator remains the person who presses Send.
 */
export class WhatsAppRedirectService implements WhatsAppProvider {
  readonly kind = 'redirect' as const;

  buildUrl(message: string, recipient?: string): string {
    const encoded = encodeURIComponent(message);
    const phone = normalizePhone(recipient);
    return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }

  dispatch(prepared: PreparedWhatsAppMessage): WhatsAppDeliveryStatus {
    if (typeof window !== 'undefined') {
      window.open(prepared.url, '_blank', 'noopener,noreferrer');
    }
    // We only ever know that WhatsApp was opened/prepared — never delivery.
    return 'PREPARED';
  }
}
