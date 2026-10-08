import { InProcessQueue, QueueJob } from '../notifications/queue';
import { notificationStore } from '../notifications/store';
import { getWhatsAppService } from '../notifications/whatsappService';
import { toInvestigatorAlert } from '../notifications/messageBuilder';
import { Investigator, NotificationEventType } from '../notifications/types';

/**
 * WhatsApp alert worker (Section 18).
 *
 * Responsibilities per job:
 *   1. Load the queued notification record
 *   2. Confirm investigator + policy still valid
 *   3. Send via the configured WhatsApp provider
 *   4. Record delivery state (+ history for the case timeline)
 *   5. Retry transient failures (handled by the queue backoff)
 *   6. Dead-letter permanent failures
 */

export interface AlertJob {
  notificationId: string;
  eventType: NotificationEventType;
  caseId: string;
  anomalyId: string;
  investigator: Investigator;
}

// backoffScale is reduced in demo so retries are observable within the session.
const scale = (process.env.WHATSAPP_MODE || 'mock').toLowerCase() === 'live' ? 1 : 0.02;
export const whatsappQueue = new InProcessQueue<AlertJob>('anomaly-alerts', scale);

whatsappQueue.setProcessor(async (job: QueueJob<AlertJob>) => {
  const { notificationId, eventType, caseId, anomalyId, investigator } = job.payload;
  const rec = notificationStore.getNotification(notificationId);
  if (!rec) return; // nothing to do

  const service = getWhatsAppService();

  notificationStore.updateStatus(notificationId, 'SENDING', `attempt ${job.attempts}`);

  const alert = toInvestigatorAlert(notificationId, eventType, caseId, anomalyId, investigator, {
    templateName: rec.templateName,
    variables: {},
    bodyText: rec.bodyText,
    caseUrl: rec.caseUrl,
  });

  const result = await service.sendAlert(alert);

  if (result.success) {
    rec.providerMessageId = result.providerMessageId;
    if (typeof result.latencyMs === 'number') {
      rec.latencyMs = result.latencyMs;
      notificationStore.recordDeliveryLatency(result.latencyMs);
    }
    notificationStore.saveNotification(rec);
    notificationStore.updateStatus(notificationId, 'SENT', service.mode === 'mock' ? 'mock delivery' : 'provider accepted');
    notificationStore.bump('alertsSent');
    notificationStore.addAudit({
      eventType: 'WHATSAPP_ALERT_SENT',
      caseId,
      anomalyId,
      investigatorId: investigator.investigatorId,
      notificationId,
      templateName: rec.templateName,
      deliveryStatus: 'SENT',
      details: `Alert sent to ${investigator.name} via ${service.mode} provider${result.providerMessageId ? ` (${result.providerMessageId})` : ''}.`,
    });

    // In mock mode, simulate the provider delivery/read webhook callbacks so the
    // full lifecycle (SENT -> DELIVERED -> READ) is demonstrable without a real device.
    if (service.mode === 'mock') {
      setTimeout(() => {
        notificationStore.updateStatus(notificationId, 'DELIVERED', 'mock webhook');
        notificationStore.bump('alertsDelivered');
      }, 400);
      setTimeout(() => {
        notificationStore.updateStatus(notificationId, 'READ', 'mock webhook');
        notificationStore.bump('alertsRead');
      }, 1200);
    }
    return;
  }

  // Failure. If the provider signalled a retryable condition and we have budget,
  // throw so the queue applies exponential backoff; otherwise fail permanently.
  if (result.status === 'RETRYING') {
    notificationStore.updateStatus(notificationId, 'RETRYING', result.error);
    throw new Error(result.error || 'Transient WhatsApp delivery failure');
  }

  notificationStore.updateStatus(notificationId, job.attempts >= 3 ? 'DEAD_LETTER' : 'FAILED', result.error);
  if (job.attempts >= 3) {
    notificationStore.bump('deadLettered');
  } else {
    notificationStore.bump('alertsFailed');
  }
  notificationStore.addAudit({
    eventType: 'WHATSAPP_ALERT_FAILED',
    caseId,
    anomalyId,
    investigatorId: investigator.investigatorId,
    notificationId,
    templateName: rec.templateName,
    deliveryStatus: rec.status,
    details: `Delivery failed: ${result.error || 'unknown error'}.`,
  });
});
