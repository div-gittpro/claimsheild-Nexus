import React, { useEffect, useState } from 'react';
import { PageHeader, Card, SectionTitle, StatCard, Pill } from '../components/common/UI';
import {
  notificationService,
  WhatsAppAlertPolicy,
  Investigator,
  NotificationMetrics,
} from '../services/notificationService';
import { useNexus } from '../store/useNexusStore';
import { BellRing, Save, Activity, Users, ShieldCheck, MessageSquare } from 'lucide-react';

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'} ${disabled ? 'opacity-40' : ''}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
  </button>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between py-2 text-xs">
    <span className="text-slate-700">{label}</span>
    {children}
  </div>
);

export const NotificationsView: React.FC = () => {
  const { whatsappMode, refreshNotifications } = useNexus();
  const [policy, setPolicy] = useState<WhatsAppAlertPolicy | null>(null);
  const [draft, setDraft] = useState<WhatsAppAlertPolicy | null>(null);
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [queue, setQueue] = useState<{ processed: number; deadLettered: number } | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const [p, inv, m] = await Promise.all([
      notificationService.getPolicy(),
      notificationService.getInvestigators(),
      notificationService.getMetrics(),
    ]);
    if (p) { setPolicy(p.policy); setDraft(p.policy); }
    if (inv) setInvestigators(inv.investigators);
    if (m) { setMetrics(m.metrics); setQueue(m.queue); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(async () => {
      const m = await notificationService.getMetrics();
      if (m) { setMetrics(m.metrics); setQueue(m.queue); }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const changed = policy && draft && JSON.stringify(policy) !== JSON.stringify(draft);

  const savePolicy = async () => {
    if (!draft) return;
    const res = await notificationService.updatePolicy(draft);
    if (res) { setPolicy(res.policy); setDraft(res.policy); setSaved(true); setTimeout(() => setSaved(false), 2500); refreshNotifications(); }
  };

  const togglePref = async (id: string, key: keyof Investigator['notificationPreferences'], value: boolean) => {
    const res = await notificationService.updatePreferences(id, { [key]: value });
    if (res) setInvestigators((prev) => prev.map((i) => (i.investigatorId === id ? res.investigator : i)));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-150">
      <PageHeader
        icon={<BellRing className="w-5 h-5" />}
        title="Notifications"
        subtitle="Event-driven WhatsApp investigator alerting. Only authorized administrators should change these settings."
        actions={
          <Pill tone={whatsappMode === 'live' ? 'emerald' : 'amber'}>WhatsApp {whatsappMode || '…'} mode</Pill>
        }
      />

      {/* System health metrics (Section 33) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Alerts generated" value={metrics?.alertsGenerated ?? '—'} icon={<Activity className="w-4 h-4" />} tone="blue" />
        <StatCard label="Sent" value={metrics?.alertsSent ?? '—'} tone="blue" />
        <StatCard label="Delivered" value={metrics?.alertsDelivered ?? '—'} tone="emerald" />
        <StatCard label="Read" value={metrics?.alertsRead ?? '—'} tone="emerald" />
        <StatCard label="Delivery rate" value={metrics ? `${Math.round(metrics.deliveryRate * 100)}%` : '—'} tone="emerald" />
        <StatCard label="Dead-letter" value={metrics?.deadLettered ?? '—'} tone={metrics && metrics.deadLettered > 0 ? 'rose' : 'default'} />
      </div>
      <div className="flex flex-wrap gap-4 mb-6 text-[11px] text-slate-500">
        <span>Duplicates prevented: <strong className="font-mono text-slate-800">{metrics?.duplicatesPrevented ?? 0}</strong></span>
        <span>Cooldown suppressed: <strong className="font-mono text-slate-800">{metrics?.cooldownSuppressed ?? 0}</strong></span>
        <span>Avg delivery latency: <strong className="font-mono text-slate-800">{metrics?.averageDeliveryLatencyMs ?? 0}ms</strong></span>
        <span>Queue processed: <strong className="font-mono text-slate-800">{queue?.processed ?? 0}</strong></span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert policy (Section 25) */}
        <Card className="p-5">
          <SectionTitle icon={<ShieldCheck className="w-4 h-4" />}>WhatsApp alert policy</SectionTitle>
          {draft ? (
            <div className="divide-y divide-slate-100">
              <Row label="WhatsApp notifications"><Toggle checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} /></Row>
              <Row label="New SIU case"><Toggle checked={draft.notifyOnNewCase} onChange={(v) => setDraft({ ...draft, notifyOnNewCase: v })} /></Row>
              <Row label="Critical anomaly"><Toggle checked={draft.notifyOnCriticalAnomaly} onChange={(v) => setDraft({ ...draft, notifyOnCriticalAnomaly: v })} /></Row>
              <Row label="Risk escalation"><Toggle checked={draft.notifyOnRiskEscalation} onChange={(v) => setDraft({ ...draft, notifyOnRiskEscalation: v })} /></Row>
              <Row label="Network escalation"><Toggle checked={draft.notifyOnNetworkEscalation} onChange={(v) => setDraft({ ...draft, notifyOnNetworkEscalation: v })} /></Row>
              <Row label="Minimum severity">
                <select value={draft.minimumSeverity} onChange={(e) => setDraft({ ...draft, minimumSeverity: e.target.value as WhatsAppAlertPolicy['minimumSeverity'] })} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Row>
              <Row label="Minimum risk">
                <input type="number" min={0} max={100} value={draft.minimumRiskScore} onChange={(e) => setDraft({ ...draft, minimumRiskScore: Number(e.target.value) })} className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center font-mono focus:outline-none" />
              </Row>
              <Row label="Minimum confidence">
                <input type="number" min={0} max={1} step={0.01} value={draft.minimumConfidence} onChange={(e) => setDraft({ ...draft, minimumConfidence: Number(e.target.value) })} className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center font-mono focus:outline-none" />
              </Row>
              <Row label="Risk escalation min change">
                <input type="number" min={1} max={50} value={draft.riskEscalationMinChange} onChange={(e) => setDraft({ ...draft, riskEscalationMinChange: Number(e.target.value) })} className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center font-mono focus:outline-none" />
              </Row>
              <Row label="Network escalation threshold">
                <input type="number" min={0} max={100} value={draft.networkEscalationThreshold} onChange={(e) => setDraft({ ...draft, networkEscalationThreshold: Number(e.target.value) })} className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center font-mono focus:outline-none" />
              </Row>
              <Row label="Cooldown (minutes)">
                <input type="number" min={0} max={1440} value={draft.cooldownMinutes} onChange={(e) => setDraft({ ...draft, cooldownMinutes: Number(e.target.value) })} className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center font-mono focus:outline-none" />
              </Row>
              <div className="pt-3 flex items-center gap-3">
                <button onClick={savePolicy} disabled={!changed} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors">
                  <Save className="w-3.5 h-3.5" /> Save Settings
                </button>
                {saved && <span className="text-xs text-emerald-600 font-medium">Saved.</span>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Loading policy…</p>
          )}
        </Card>

        {/* Investigator preferences (Section 26) */}
        <Card className="p-5">
          <SectionTitle icon={<Users className="w-4 h-4" />}>Investigators & preferences</SectionTitle>
          <div className="space-y-3">
            {investigators.map((inv) => (
              <div key={inv.investigatorId} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-900">{inv.name}</span>
                    <span className="text-[10px] text-slate-500 block">{inv.role} · {inv.investigatorId}{inv.isDutyOfficer ? ' · duty officer' : ''}</span>
                  </div>
                  <Pill tone={inv.whatsappEnabled ? 'emerald' : 'default'}>{inv.whatsappEnabled ? 'WA on' : 'WA off'}</Pill>
                </div>
                <div className="grid grid-cols-2 gap-x-4 mt-2">
                  <Row label="Critical (mandatory)"><Toggle checked disabled onChange={() => {}} /></Row>
                  <Row label="New case"><Toggle checked={inv.notificationPreferences.newCase} onChange={(v) => togglePref(inv.investigatorId, 'newCase', v)} /></Row>
                  <Row label="Risk escalation"><Toggle checked={inv.notificationPreferences.riskEscalation} onChange={(v) => togglePref(inv.investigatorId, 'riskEscalation', v)} /></Row>
                  <Row label="Network escalation"><Toggle checked={inv.notificationPreferences.networkEscalation} onChange={(v) => togglePref(inv.investigatorId, 'networkEscalation', v)} /></Row>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Mandatory critical notifications cannot be disabled by investigators.</p>
        </Card>
      </div>

      <Card className="p-4 mt-6 flex items-start gap-2 text-[11px] text-slate-500">
        <MessageSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <span>
          WhatsApp messages contain the minimum necessary information (case ID, provider ID, anomaly type, risk, exposure, secure link).
          No patient names, diagnoses or clinical detail are ever sent. Risk is not proof — the investigator makes the final decision.
        </span>
      </Card>
    </div>
  );
};
