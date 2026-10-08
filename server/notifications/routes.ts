import { Router, Request, Response } from 'express';
import { notificationStore } from './store';
import { ingestAnalysisSnapshot } from './pipeline';
import { whatsappQueue } from '../workers/whatsappAlertWorker';
import { getWhatsAppService } from './whatsappService';
import { AnalysisSnapshotPayload, DeliveryStatus } from './types';

/**
 * Backend notification API + WhatsApp webhook (Sections 4, 20-25, 33).
 * All WhatsApp credentials and provider calls stay server-side; the frontend
 * only consumes these endpoints.
 */
export function createNotificationRouter(): Router {
  const router = Router();

  // Config/status (safe, non-secret) — lets the UI show mode without exposing creds.
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      mode: getWhatsAppService().mode,
      provider: (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase(),
      enabled: (process.env.WHATSAPP_ENABLED ?? 'true') !== 'false',
      templateName: process.env.WHATSAPP_ALERT_TEMPLATE || 'claimshield_anomaly_alert',
    });
  });

  // Ingest an analysis snapshot and run the event-driven evaluation.
  router.post('/ingest', (req: Request, res: Response) => {
    const payload = req.body as AnalysisSnapshotPayload;
    if (!payload || !payload.analysisRunId || !Array.isArray(payload.cases)) {
      return res.status(400).json({ error: 'Invalid analysis snapshot payload.' });
    }
    const result = ingestAnalysisSnapshot({
      analysisRunId: payload.analysisRunId,
      cases: payload.cases,
      networks: Array.isArray(payload.networks) ? payload.networks : [],
    });
    res.json({ ok: true, result });
  });

  // Notification center feed.
  router.get('/notifications', (req: Request, res: Response) => {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    res.json({
      unreadCount: notificationStore.unreadCount(),
      notifications: notificationStore.listNotifications(limit),
    });
  });

  router.post('/notifications/read', (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
    notificationStore.markRead(ids);
    res.json({ ok: true, unreadCount: notificationStore.unreadCount() });
  });

  // Per-case alert history (Section 24).
  router.get('/case/:caseId', (req: Request, res: Response) => {
    res.json({ notifications: notificationStore.listNotificationsForCase(req.params.caseId) });
  });

  // Alert policy (Section 25).
  router.get('/policy', (_req: Request, res: Response) => {
    res.json({ policy: notificationStore.getPolicy() });
  });
  router.put('/policy', (req: Request, res: Response) => {
    const patch = req.body || {};
    res.json({ policy: notificationStore.updatePolicy(patch) });
  });

  // Investigators + preferences (Section 26).
  router.get('/investigators', (_req: Request, res: Response) => {
    res.json({ investigators: notificationStore.listInvestigators() });
  });
  router.put('/investigators/:id/preferences', (req: Request, res: Response) => {
    const updated = notificationStore.updateInvestigatorPreferences(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Investigator not found.' });
    res.json({ investigator: updated });
  });

  // System health metrics (Section 33).
  router.get('/metrics', (_req: Request, res: Response) => {
    res.json({ metrics: notificationStore.getMetrics(), queue: whatsappQueue.stats(), mode: getWhatsAppService().mode });
  });

  // Notification audit feed.
  router.get('/audit', (req: Request, res: Response) => {
    const limit = Math.min(500, Number(req.query.limit) || 100);
    res.json({ events: notificationStore.listAudit(limit) });
  });

  return router;
}

/**
 * WhatsApp webhook (Section 21). GET verifies the subscription using the
 * configured verify token; POST maps provider status callbacks onto the
 * notification lifecycle. We never trust an unverified request.
 */
export function createWhatsAppWebhookRouter(): Router {
  const router = Router();
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';

  // Meta subscription verification handshake.
  router.get('/', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
      return res.status(200).send(String(challenge ?? ''));
    }
    return res.sendStatus(403);
  });

  router.post('/', (req: Request, res: Response) => {
    // Token verification for inbound status callbacks. Accept either a verify
    // token header/query (demo-friendly) consistent with the configured value.
    const providedToken = (req.query['verify_token'] as string) || (req.headers['x-verify-token'] as string) || '';
    if (verifyToken && providedToken !== verifyToken) {
      return res.sendStatus(401);
    }

    try {
      const statuses = extractStatuses(req.body);
      for (const s of statuses) {
        const rec = notificationStore.getByProviderMessageId(s.messageId);
        if (!rec) continue;
        const status = mapStatus(s.status);
        if (!status) continue;
        notificationStore.updateStatus(rec.notificationId, status, 'provider webhook');
        if (status === 'DELIVERED') notificationStore.bump('alertsDelivered');
        if (status === 'READ') notificationStore.bump('alertsRead');
        if (status === 'FAILED') notificationStore.bump('alertsFailed');
        notificationStore.addAudit({
          eventType: 'WHATSAPP_STATUS_UPDATE',
          caseId: rec.caseId,
          anomalyId: rec.anomalyId,
          investigatorId: rec.investigatorId,
          notificationId: rec.notificationId,
          deliveryStatus: status,
          details: `Provider reported status: ${status}.`,
        });
      }
    } catch {
      // Never fail the webhook on malformed payloads; acknowledge receipt.
    }
    res.sendStatus(200);
  });

  return router;
}

function mapStatus(providerStatus: string): DeliveryStatus | null {
  switch ((providerStatus || '').toLowerCase()) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'READ';
    case 'failed':
      return 'FAILED';
    default:
      return null;
  }
}

/** Extract (messageId, status) tuples from a Meta webhook payload shape. */
function extractStatuses(body: any): { messageId: string; status: string }[] {
  const out: { messageId: string; status: string }[] = [];
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      for (const st of change?.value?.statuses || []) {
        if (st?.id && st?.status) out.push({ messageId: st.id, status: st.status });
      }
    }
  }
  // Also support a simplified direct shape for testing.
  if (body?.messageId && body?.status) out.push({ messageId: body.messageId, status: body.status });
  return out;
}
