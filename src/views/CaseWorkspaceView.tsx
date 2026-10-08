import React, { useEffect, useMemo, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { NetworkGraph } from '../components/network/NetworkGraph';
import { DigitalTwinTimeline } from '../components/digitaltwin/DigitalTwinTimeline';
import { RiskTrajectoryChart } from '../components/analytics/AnalyticalCharts';
import { llmService } from '../services/llm/GroqLLMService';
import { InvestigationEvidencePackage, StructuredInvestigationBrief } from '../services/llm/types';
import { notificationService, NotificationRecord } from '../services/notificationService';
import { WhatsAppAlertButton } from '../components/notifications/WhatsAppAlertButton';
import { useWhatsAppHistoryForCase } from '../services/whatsapp/history';
import { HumanFeedbackOutcome, GraphNode, DigitalTwinTimelinePoint } from '../types';
import {
  Sparkles, ShieldAlert, ArrowRight, TrendingUp, Clock, CheckCircle2, Copy, ChevronDown,
  Bot, UserPlus, Play, FileSearch, ArrowUpCircle, CheckCheck, Beaker, Users, Building2,
  FileSpreadsheet, Network, ScrollText, Stethoscope,
} from 'lucide-react';

type CaseTab =
  | 'OVERVIEW' | 'EVIDENCE' | 'TIMELINE' | 'NETWORK' | 'DIGITAL_TWIN' | 'FORECAST'
  | 'CLAIMS' | 'MEMBERS' | 'FACILITIES' | 'INVESTIGATION' | 'AI_BRIEF' | 'AUDIT';

const TABS: { id: CaseTab; label: string }[] = [
  { id: 'OVERVIEW', label: 'Overview' },
  { id: 'EVIDENCE', label: 'Evidence' },
  { id: 'TIMELINE', label: 'Timeline' },
  { id: 'NETWORK', label: 'Network' },
  { id: 'DIGITAL_TWIN', label: 'Digital Twin' },
  { id: 'FORECAST', label: 'Forecast' },
  { id: 'CLAIMS', label: 'Claims' },
  { id: 'MEMBERS', label: 'Members' },
  { id: 'FACILITIES', label: 'Facilities' },
  { id: 'INVESTIGATION', label: 'Investigation' },
  { id: 'AI_BRIEF', label: 'AI Brief' },
  { id: 'AUDIT', label: 'Audit' },
];

const DECISION_OPTIONS: { value: HumanFeedbackOutcome; label: string }[] = [
  { value: 'CONFIRMED_FWA', label: 'Confirmed concern' },
  { value: 'NOT_FWA', label: 'No concern' },
  { value: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient evidence' },
  { value: 'LIKELY_FWA', label: 'Escalate' },
  { value: 'FALSE_POSITIVE', label: 'Monitor' },
];

function layoutNodes(nodes: GraphNode[]): GraphNode[] {
  const providers = nodes.filter((n) => n.type === 'PROVIDER');
  const others = nodes.filter((n) => n.type !== 'PROVIDER');
  const cx = 360, cy = 220;
  const place = (list: GraphNode[], radius: number) =>
    list.map((n, i) => {
      const angle = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return { ...n, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
  return [...place(providers, providers.length > 1 ? 120 : 0), ...place(others, 220)];
}

const Metric: React.FC<{ label: string; value: React.ReactNode; sub?: string; tone?: string }> = ({ label, value, sub, tone = 'text-slate-900' }) => {
  const accent = tone.includes('rose') ? 'from-rose-500 to-rose-400'
    : tone.includes('purple') ? 'from-purple-500 to-purple-400'
    : tone.includes('amber') ? 'from-amber-500 to-amber-400'
    : tone.includes('emerald') ? 'from-emerald-500 to-emerald-400'
    : 'from-blue-600 to-blue-400';
  return (
    <div className="relative p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 overflow-hidden">
      <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent}`} />
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">{label}</span>
      <div className={`text-xl font-bold font-mono mt-0.5 ${tone}`}>{value}</div>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
};

export const CaseWorkspaceView: React.FC = () => {
  const {
    currentCase, currentProvider, claims, members, facilities, currentNetwork, graphData,
    timelinePoints, timelineIndex, setTimelineIndex, simulationResult, simulationParams,
    updateSimulationParams, recordInvestigatorFeedback, auditChain, setCopilotOpen,
    siuQueue,
  } = useNexus();

  const [tab, setTab] = useState<CaseTab>('OVERVIEW');
  const [brief, setBrief] = useState<StructuredInvestigationBrief | null>(currentCase?.brief ? null : null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<string | null>(null);
  const [simRan, setSimRan] = useState(false);
  const [decision, setDecision] = useState<HumanFeedbackOutcome | ''>('');
  const [rationale, setRationale] = useState('');
  const [investigator, setInvestigator] = useState('Investigator Jenkins');
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [headerAction, setHeaderAction] = useState<string | null>(null);
  const [caseAlerts, setCaseAlerts] = useState<NotificationRecord[]>([]);

  const c = currentCase;
  if (!c) {
    return <div className="p-8 text-sm text-slate-500">No case selected. Open a case from the SIU Queue.</div>;
  }

  const siuScore = siuQueue.scored.find((s) => s.id === c.id)?.siuScore;
  const relatedClaims = useMemo(() => claims.filter((cl) => cl.providerId === c.targetId), [claims, c.targetId]);
  const relatedMembers = useMemo(() => {
    const ids = new Set(relatedClaims.map((cl) => cl.memberId));
    return members.filter((m) => ids.has(m.id));
  }, [members, relatedClaims]);
  const relatedFacilities = useMemo(() => {
    const ids = new Set(relatedClaims.map((cl) => cl.facilityId));
    return facilities.filter((f) => ids.has(f.id));
  }, [facilities, relatedClaims]);

  const positionedNodes = useMemo(() => layoutNodes(graphData.nodes), [graphData.nodes]);
  const caseAudit = useMemo(() => auditChain.filter((b) => b.entityId === c.id || b.details.includes(c.id)), [auditChain, c.id]);
  const waHistory = useWhatsAppHistoryForCase(c.id);

  // WhatsApp alert history for this case (Section 24). Polled while the Audit tab is open.
  useEffect(() => {
    let active = true;
    const fetchAlerts = () => {
      notificationService.forCase(c.id).then((d) => { if (active && d) setCaseAlerts(d.notifications); });
    };
    fetchAlerts();
    const timer = tab === 'AUDIT' ? setInterval(fetchAlerts, 4000) : null;
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [c.id, tab]);

  // Evidence grouped by detector for the Evidence tab filter (Section 10).
  const evidenceByDetector = useMemo(() => {
    const map = new Map<string, number>();
    c.evidenceBreakdown.forEach((e) => map.set(e.ruleName, (map.get(e.ruleName) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [c.evidenceBreakdown]);

  const filteredEvidence = evidenceFilter ? c.evidenceBreakdown.filter((e) => e.ruleName === evidenceFilter) : c.evidenceBreakdown;

  // Priority contribution from the SIU scoring engine, falling back to the provider risk drivers.
  const priorityContributions = siuScore?.contributions || (currentProvider?.riskDrivers || []).map((d) => ({ label: d.type.replace(/_/g, ' '), value: d.contribution }));

  const detectorTypes = c.evidenceTypes?.length || new Set(c.evidenceBreakdown.map((e) => e.ruleName)).size;

  // Full digital-twin timeline with derived forecast tail.
  const fullTwin: DigitalTwinTimelinePoint[] = useMemo(() => {
    const observed = timelinePoints.filter((t) => !t.isFuture);
    if (observed.length === 0) return observed;
    const last = observed[observed.length - 1];
    const fc = [
      { h: '30D Forecast', o: 30, r: c.forecast30d, e: currentProvider?.projectedExposure30d || 0 },
      { h: '60D Forecast', o: 60, r: c.forecast60d, e: currentProvider?.projectedExposure60d || 0 },
      { h: '90D Forecast', o: 90, r: c.forecast90d, e: currentProvider?.projectedExposure90d || 0 },
    ].filter((f) => f.r > 0).map((f) => ({
      periodLabel: f.h, daysOffset: f.o, isFuture: true, riskScore: f.r, claimVolume: last.claimVolume,
      networkDegree: last.networkDegree, estimatedExposure: f.e, referralDensity: last.referralDensity,
      anomalyScore: last.anomalyScore, summaryNote: `Projected state at ${f.h}. Forecast, not a guarantee.`,
    }));
    return [...observed, ...fc];
  }, [timelinePoints, c, currentProvider]);

  const handleGenerateBrief = async () => {
    setIsGenerating(true);
    setGenStep('Assembling verified evidence package from canonical state...');
    try {
      const pkg: InvestigationEvidencePackage = {
        case: { caseId: c.id, status: c.status, priority: c.priorityScore, title: c.title },
        provider: {
          providerId: c.targetId, name: c.targetName, specialty: c.specialty || 'Unspecified',
          riskScore: c.riskScore, evidenceStrength: c.evidenceStrength, peerDeviationFactor: currentProvider?.peerDeviationFactor || 0,
        },
        claimSignals: c.evidenceBreakdown.map((e) => ({
          evidenceId: e.id, type: e.category.toLowerCase(), count: e.supportingRecordIds.length,
          severity: e.severity.toLowerCase(), detail: e.observedFact, citations: e.supportingRecordIds,
        })),
        behaviorSignals: (currentProvider?.peerComparisons || []).map((pc) => ({
          evidenceId: c.evidenceBreakdown[0]?.id || 'none', metric: pc.metric, value: pc.providerVal, peerBaseline: pc.peerVal, unit: pc.unit,
        })),
        networkSignals: currentNetwork ? [{
          evidenceId: c.evidenceBreakdown.find((e) => e.category === 'COORDINATED_NETWORK')?.id || 'none',
          type: 'Relationship concentration', value: Math.round((currentNetwork.referralDensity || 0) * 100), relatedEntityId: currentNetwork.id,
        }] : [],
        timeline: timelinePoints.map((t) => ({ date: t.periodLabel, risk: t.riskScore, note: t.summaryNote })),
        forecast: { horizon30d: c.forecast30d, horizon60d: c.forecast60d, horizon90d: c.forecast90d, confidence: c.forecastConfidence },
        financial: { currentExposure: c.estimatedExposure, projected90dExposure: currentProvider?.projectedExposure90d || 0 },
        memberImpact: { severity: c.memberImpactTier, affectedCount: c.affectedMembersCount, impactScore: c.memberImpactScore },
      };
      setGenStep('Reasoning over verified evidence with Groq...');
      const generated = await llmService.generateInvestigationBrief(pkg);
      setBrief(generated);
    } finally {
      setIsGenerating(false);
      setGenStep(null);
    }
  };

  const handleCopyBrief = () => {
    if (!brief) return;
    const text = `CLAIMSHIELD NEXUS — INVESTIGATION BRIEF\nCase: ${c.id} · ${c.targetName} (${c.targetId})\n\nEXECUTIVE SUMMARY\n${brief.executiveSummary}\n\nKEY EVIDENCE\n${brief.keyEvidence.map((e) => `- [${e.evidenceId}] ${e.finding}`).join('\n')}\n\nRECOMMENDED HUMAN REVIEW\n${brief.recommendedActions.map((a) => `- ${a.action}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision || !rationale.trim()) return;
    recordInvestigatorFeedback(c.id, decision, rationale, investigator);
    setDecisionSaved(true);
    setRationale('');
    setTimeout(() => setDecisionSaved(false), 3000);
  };

  const headerActions = [
    { id: 'assign', label: 'Assign', icon: <UserPlus className="w-3.5 h-3.5" /> },
    { id: 'start', label: 'Start Investigation', icon: <Play className="w-3.5 h-3.5" /> },
    { id: 'request', label: 'Request Evidence', icon: <FileSearch className="w-3.5 h-3.5" /> },
    { id: 'escalate', label: 'Escalate', icon: <ArrowUpCircle className="w-3.5 h-3.5" /> },
    { id: 'resolve', label: 'Resolve', icon: <CheckCheck className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-6 max-w-[90rem] mx-auto space-y-5 animate-in fade-in duration-150">
      {/* Case header (Section 7) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg font-bold text-slate-900">{c.id}</span>
              <StatusBadge status={c.status} />
              {siuScore && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                  {siuScore.recommendation.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
              <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-mono text-slate-500">{c.targetId}</span>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-slate-900">{c.targetName}</span>
              <span className="text-slate-300">·</span>
              <span>{c.specialty || 'Provider'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <WhatsAppAlertButton caseRecord={c} />
            <button onClick={() => setCopilotOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors">
              <Bot className="w-3.5 h-3.5 text-blue-600" /> Ask Copilot
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="Risk" value={c.riskScore} tone="text-rose-700" />
          <Metric label="Priority" value={c.priorityScore} />
          <Metric label="Evidence" value={`${c.evidenceStrength}%`} />
          <Metric label="Exposure" value={`$${c.estimatedExposure.toLocaleString()}`} />
          <Metric label="Member impact" value={c.affectedMembersCount} sub={c.memberImpactTier} />
          <Metric label="Network risk" value={c.networkRiskScore} sub={c.networkId || 'no network'} tone="text-purple-700" />
        </div>

        {/* Human-only actions (Section 7) */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          {headerActions.map((a) => (
            <button
              key={a.id}
              onClick={() => { setHeaderAction(a.id); if (a.id === 'resolve' || a.id === 'escalate') setTab('INVESTIGATION'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 transition-colors"
            >
              {a.icon} {a.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-400 ml-auto">Decision support only — no automated adverse actions.</span>
        </div>
        {headerAction && (
          <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            {headerAction === 'assign' && 'Assignment is a human workflow action — record the assignee in the Investigation tab.'}
            {headerAction === 'start' && 'Investigation started. Work through Evidence, Network and Forecast, then record a decision.'}
            {headerAction === 'request' && 'Evidence request logged as a human-review action. No payment is affected.'}
            {headerAction === 'escalate' && 'Escalation requires a documented human decision — complete the Investigation tab.'}
            {headerAction === 'resolve' && 'Resolution requires a documented human decision — complete the Investigation tab.'}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto text-xs">
        {TABS.map((t) => {
          const sel = tab === t.id;
          const count = t.id === 'EVIDENCE' ? c.evidenceBreakdown.length : t.id === 'CLAIMS' ? relatedClaims.length : t.id === 'MEMBERS' ? relatedMembers.length : t.id === 'FACILITIES' ? relatedFacilities.length : undefined;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3.5 py-2 font-medium border-b-2 whitespace-nowrap transition-all ${sel ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
              {t.label}{count !== undefined ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {genStep && (
        <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2 animate-pulse">
          <Sparkles className="w-4 h-4 shrink-0" /> {genStep}
        </div>
      )}

      {/* ===== OVERVIEW ===== */}
      {tab === 'OVERVIEW' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Why this case */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Why this case?</h2>
              </div>
              <div className="space-y-2">
                {(currentProvider?.siuEligibilityReasons || []).map((r) => (
                  <div key={r} className="flex items-start gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" /><span className="text-slate-700">{r}</span></div>
                ))}
                {(!currentProvider?.siuEligibilityReasons || currentProvider.siuEligibilityReasons.length === 0) && (
                  <p className="text-xs text-slate-500">Eligibility reasons unavailable.</p>
                )}
              </div>
            </div>

            {/* Priority contribution (Section 9) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Priority contribution</h2>
              </div>
              <div className="space-y-2">
                {priorityContributions.map((d) => (
                  <div key={d.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs"><span className="text-slate-600 capitalize">{d.label.toLowerCase()}</span><span className="font-mono font-semibold text-slate-800">+{d.value}</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, d.value * 3)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk trajectory */}
          <RiskTrajectoryChart riskState={currentProvider?.riskState} providerId={c.targetId} />

          <div className="flex justify-end">
            <button onClick={() => setTab('EVIDENCE')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors">Review Evidence <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* ===== EVIDENCE ===== */}
      {tab === 'EVIDENCE' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Signals" value={c.evidenceBreakdown.length} />
            <Metric label="Detector types" value={detectorTypes} />
            <Metric label="Evidence strength" value={`${c.evidenceStrength}%`} />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Evidence by detector</h2>
              {evidenceFilter && <button onClick={() => setEvidenceFilter(null)} className="text-[11px] text-blue-600 font-semibold">Clear filter</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {evidenceByDetector.map(([name, count]) => (
                <button key={name} onClick={() => setEvidenceFilter(evidenceFilter === name ? null : name)} className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${evidenceFilter === name ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                  {name.replace(/_/g, ' ')} <span className="font-mono">{count}</span>
                </button>
              ))}
              {evidenceByDetector.length === 0 && <span className="text-xs text-slate-500">No evidence signals generated.</span>}
            </div>
          </div>

          {/* Evidence cards (Section 11-12) */}
          <div className="space-y-3">
            {filteredEvidence.map((e) => {
              const isOpen = expandedEvidence === e.id;
              const detail = (() => { try { return JSON.parse(e.description); } catch { return null; } })();
              const cites = e.supportingRecordIds;
              const sampleClaim = relatedClaims.find((cl) => cites.includes(cl.id));
              return (
                <div key={e.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedEvidence(isOpen ? null : e.id)} className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-blue-700 px-2 py-0.5 bg-blue-50 rounded border border-blue-200">{e.id}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{e.ruleName.replace(/_/g, ' ')}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-semibold text-slate-900">{e.observedFact}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${e.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{e.severity}</span>
                      <span className="text-xs font-mono font-semibold text-slate-700">+{e.contributionScore} pts</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                        <div><span className="text-slate-400 block">Detector</span><span className="font-semibold text-slate-800">{e.ruleName.replace(/_/g, ' ')}</span></div>
                        <div><span className="text-slate-400 block">Severity</span><span className="font-semibold text-slate-800">{e.severity}</span></div>
                        <div><span className="text-slate-400 block">Weight</span><span className="font-mono text-slate-800">{e.weightPercentage}%</span></div>
                        <div><span className="text-slate-400 block">Timestamp</span><span className="font-mono text-slate-800">{new Date(e.timestamp).toLocaleString()}</span></div>
                        <div><span className="text-slate-400 block">Target entity</span><span className="font-mono text-slate-800">{c.targetId}</span></div>
                        <div><span className="text-slate-400 block">Claim IDs</span><span className="font-mono text-slate-800">{cites.length} records</span></div>
                        <div><span className="text-slate-400 block">Model inference</span><span className="text-slate-800">{e.modelInference}</span></div>
                        <div><span className="text-slate-400 block">Source</span><span className="text-slate-800">Claims dataset / analytical engine</span></div>
                      </div>
                      {detail && (
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[10px] text-slate-600 overflow-x-auto">
                          {Object.entries(detail).map(([k, v]) => (<div key={k}>{k}: {JSON.stringify(v)}</div>))}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-slate-800 block mb-1 text-[11px]">Supporting claims (traceability):</span>
                        <div className="flex flex-wrap gap-1">
                          {cites.slice(0, 12).map((id) => (<span key={id} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-blue-700">{id}</span>))}
                        </div>
                      </div>
                      {sampleClaim && (
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] flex items-center justify-between font-mono">
                          <span><strong>{sampleClaim.id}</strong> · CPT {sampleClaim.procedureCode}</span>
                          <span className="font-sans text-slate-500">{sampleClaim.serviceDate} · ${sampleClaim.billedAmount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== TIMELINE ===== */}
      {tab === 'TIMELINE' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Investigation timeline</h2>
          <div className="space-y-0">
            {timelinePoints.map((pt, i) => (
              <div key={`${pt.periodLabel}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  {i < timelinePoints.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">{pt.periodLabel}</span>
                    <span className="text-[11px] font-mono text-slate-500">Risk {pt.riskScore}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{pt.summaryNote}</p>
                </div>
              </div>
            ))}
            {timelinePoints.length > 0 && (
              <div className="flex gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                <div><span className="text-xs font-bold text-rose-700">Today — case created</span><p className="text-[11px] text-slate-600 mt-0.5">SIU eligibility triggered; case {c.id} created for human review.</p></div>
              </div>
            )}
            {timelinePoints.length === 0 && <p className="text-xs text-slate-500">Insufficient history for a chronological timeline.</p>}
          </div>
        </div>
      )}

      {/* ===== NETWORK ===== */}
      {tab === 'NETWORK' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Metric label="Network risk" value={currentNetwork?.riskScore ?? '—'} tone="text-purple-700" />
            <Metric label="Providers" value={graphData.nodes.filter((n) => n.type === 'PROVIDER').length} />
            <Metric label="Facilities" value={graphData.nodes.filter((n) => n.type === 'FACILITY').length} />
            <Metric label="Shared members" value={currentNetwork?.memberCount ?? 0} />
            <Metric label="Referral links" value={graphData.edges.filter((e) => e.type === 'REFERS').length} />
            <Metric label="Trajectory" value={currentNetwork?.trajectory?.toLowerCase() || '—'} tone="text-slate-700" />
          </div>
          {graphData.nodes.length > 0 ? (
            <div className="h-[480px]">
              <NetworkGraph nodes={positionedNodes} edges={graphData.edges} networkTitle={currentNetwork ? `${currentNetwork.id} · ${currentNetwork.name}` : 'Case relationships'} selectedNodeId={c.targetId} />
            </div>
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-500">No connected cluster detected for this case. The provider does not share both members and facilities with others.</div>
          )}
          <p className="text-[11px] text-slate-400">Emerging network / connected provider cluster. Relationship concentration is a review signal — risk is not proof.</p>
        </div>
      )}

      {/* ===== DIGITAL TWIN ===== */}
      {tab === 'DIGITAL_TWIN' && (
        <DigitalTwinTimeline points={fullTwin} selectedIndex={Math.min(timelineIndex, Math.max(0, fullTwin.length - 1))} onSelectIndex={setTimelineIndex} entityName={`${c.targetName} (${c.targetId})`} />
      )}

      {/* ===== FORECAST ===== */}
      {tab === 'FORECAST' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">30 / 60 / 90-day risk forecast</h2>
              <span className="text-[11px] text-slate-500">Confidence {c.forecastConfidence}%</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">Current</span><span className="text-2xl font-bold font-mono text-slate-900">{c.riskScore}</span></div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">30D</span><span className="text-2xl font-bold font-mono text-slate-900">{c.forecast30d || '—'}</span></div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">60D</span><span className="text-2xl font-bold font-mono text-amber-600">{c.forecast60d || '—'}</span></div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">90D</span><span className="text-2xl font-bold font-mono text-rose-600">{c.forecast90d || '—'}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">Projected exposure 30D</span><span className="font-mono font-bold text-slate-900">${(currentProvider?.projectedExposure30d || 0).toLocaleString()}</span></div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">60D</span><span className="font-mono font-bold text-slate-900">${(currentProvider?.projectedExposure60d || 0).toLocaleString()}</span></div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">90D</span><span className="font-mono font-bold text-rose-700">${(currentProvider?.projectedExposure90d || 0).toLocaleString()}</span></div>
            </div>
            <p className="text-[11px] text-slate-400">Forecast is a projection of the observed trajectory, never a certainty.</p>
          </div>

          {/* Scenario simulator (Section 19) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Beaker className="w-4 h-4 text-purple-600" /><h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Scenario Simulator</h2></div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold uppercase tracking-wider">Simulated scenario — not a guarantee</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-3">
                {[
                  { key: 'claimGrowthPercent' as const, label: 'Claim growth', max: 100, suffix: '%' },
                  { key: 'referralGrowthPercent' as const, label: 'Referral concentration', max: 100, suffix: '%' },
                  { key: 'highValueSpikePercent' as const, label: 'High-value claim rate', max: 100, suffix: '%' },
                  { key: 'networkExpansionCount' as const, label: 'Network expansion', max: 10, suffix: ' nodes' },
                  { key: 'interventionIntensityPercent' as const, label: 'Investigation intervention', max: 100, suffix: '%' },
                ].map((s) => (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs"><span className="text-slate-600">{s.label}</span><span className="font-mono font-semibold text-blue-700">{simulationParams[s.key]}{s.suffix}</span></div>
                    <input type="range" min={0} max={s.max} value={simulationParams[s.key]} onChange={(e) => { updateSimulationParams({ [s.key]: Number(e.target.value) }); setSimRan(false); }} className="w-full accent-blue-600" />
                  </div>
                ))}
                <button onClick={() => setSimRan(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"><Play className="w-3.5 h-3.5" /> Run Scenario</button>
              </div>
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Baseline</span>
                  <div><span className="text-[10px] text-slate-400 uppercase block">90D Risk</span><span className="text-4xl font-bold font-mono text-rose-700">{simulationResult.scenarioA.risk90d}</span></div>
                </div>
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Simulated intervention</span>
                  <div><span className="text-[10px] text-slate-400 uppercase block">90D Risk</span><span className="text-4xl font-bold font-mono text-emerald-700">{simulationResult.scenarioB.risk90d}</span></div>
                </div>
                <div className="sm:col-span-2 p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-600">Difference</span>
                  <span className="text-lg font-bold font-mono text-emerald-700">{simulationResult.scenarioB.risk90d - simulationResult.scenarioA.risk90d}</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">The simulation engine computes these values; the AI only explains the result.</p>
          </div>
        </div>
      )}

      {/* ===== CLAIMS ===== */}
      {tab === 'CLAIMS' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-800">Associated claims ({relatedClaims.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                <tr><th className="py-2.5 px-4">Claim</th><th className="py-2.5 px-4">Date</th><th className="py-2.5 px-4">Member</th><th className="py-2.5 px-4">Procedure</th><th className="py-2.5 px-4 text-right">Amount</th><th className="py-2.5 px-4">Facility</th><th className="py-2.5 px-4">Signals</th><th className="py-2.5 px-4 text-center">Risk</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {relatedClaims.map((cl) => (
                  <tr key={cl.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{cl.id}</td>
                    <td className="py-2.5 px-4 text-slate-500">{cl.serviceDate}</td>
                    <td className="py-2.5 px-4 text-slate-700">{cl.memberId}</td>
                    <td className="py-2.5 px-4 text-blue-700">CPT {cl.procedureCode}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">${cl.billedAmount.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-slate-600">{cl.facilityId}</td>
                    <td className="py-2.5 px-4 font-sans">{cl.flags.length ? cl.flags.slice(0, 2).map((f) => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 mr-1">{f.replace(/_/g, ' ')}</span>) : <span className="text-slate-400">None</span>}</td>
                    <td className="py-2.5 px-4 text-center"><span className={`px-1.5 py-0.5 rounded font-bold ${cl.riskScore >= 70 ? 'bg-rose-50 text-rose-700' : cl.riskScore >= 40 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{cl.riskScore}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MEMBERS ===== */}
      {tab === 'MEMBERS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Members affected" value={c.affectedMembersCount} />
            <Metric label="Impact tier" value={c.memberImpactTier} tone="text-rose-700" />
            <Metric label="Impact score" value={c.memberImpactScore} />
            <Metric label="Potential unnecessary procedures" value={c.potentialUnnecessaryProcedures} />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-800">Affected members (synthetic identifiers)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                  <tr><th className="py-2.5 px-4">Member</th><th className="py-2.5 px-4 text-center">Claims</th><th className="py-2.5 px-4 text-right">Total paid</th><th className="py-2.5 px-4">Impact tier</th><th className="py-2.5 px-4">Factors</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {relatedMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{m.id}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{m.totalClaims}</td>
                      <td className="py-2.5 px-4 text-right font-mono">${m.totalPaid.toLocaleString()}</td>
                      <td className="py-2.5 px-4"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.impactTier === 'HIGH' || m.impactTier === 'CRITICAL' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{m.impactTier}</span></td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-600">{m.impactFactors.slice(0, 2).map((f) => f.replace(/_/g, ' ')).join(', ') || '—'}</td>
                    </tr>
                  ))}
                  {relatedMembers.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500 text-xs">No affected members resolved.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Member identifiers are synthetic. PII is not exposed in the investigation workflow.</p>
        </div>
      )}

      {/* ===== FACILITIES ===== */}
      {tab === 'FACILITIES' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-600" /> Connected facilities ({relatedFacilities.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                <tr><th className="py-2.5 px-4">Facility</th><th className="py-2.5 px-4">Location</th><th className="py-2.5 px-4 text-center">Claims</th><th className="py-2.5 px-4 text-center">Providers</th><th className="py-2.5 px-4 text-right">Billed</th><th className="py-2.5 px-4 text-center">Risk</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatedFacilities.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4"><span className="font-semibold text-slate-900">{f.name}</span><span className="text-[10px] text-slate-400 block font-mono">{f.id}</span></td>
                    <td className="py-2.5 px-4 text-slate-600">{f.location || '—'}</td>
                    <td className="py-2.5 px-4 text-center font-mono">{f.claimsProcessed}</td>
                    <td className="py-2.5 px-4 text-center font-mono">{f.activeProviders.length}</td>
                    <td className="py-2.5 px-4 text-right font-mono">${f.totalBilled.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-center"><span className={`px-1.5 py-0.5 rounded font-bold font-mono ${f.riskScore >= 70 ? 'bg-rose-50 text-rose-700' : f.riskScore >= 40 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{f.riskScore}</span></td>
                  </tr>
                ))}
                {relatedFacilities.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500 text-xs">No connected facilities.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== INVESTIGATION (human decision) ===== */}
      {tab === 'INVESTIGATION' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Human decision</h2>
            <p className="text-[11px] text-slate-500">Every investigation ends with a human decision. The system is decision support — it never confirms fraud on its own.</p>
            {decisionSaved && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Decision recorded to the audit ledger.</div>}
            <form onSubmit={handleSubmitDecision} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-800 block mb-2">Decision</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {DECISION_OPTIONS.map((opt) => (
                    <label key={opt.value} className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${decision === opt.value ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-100 font-semibold' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                      <input type="radio" name="decision" value={opt.value} checked={decision === opt.value} onChange={() => setDecision(opt.value)} className="accent-blue-600" />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">Reason & supporting evidence</label>
                <textarea rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Reference supporting evidence IDs (e.g. EVD-...) and the rationale for this decision." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500" required />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.evidenceBreakdown.slice(0, 6).map((e) => (
                    <button type="button" key={e.id} onClick={() => setRationale((r) => `${r}${r ? ' ' : ''}${e.id}`)} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-blue-700 hover:bg-blue-50">{e.id}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-slate-500">Investigator: <input type="text" value={investigator} onChange={(e) => setInvestigator(e.target.value)} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 font-medium" /></label>
                <button type="submit" disabled={!decision || !rationale.trim()} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs transition-colors">Record Decision</button>
              </div>
            </form>
          </div>

          {c.humanFeedback && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-xs space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">Recorded decision</h3>
              <div><span className="text-slate-400">Decision: </span><span className="font-semibold text-slate-800">{c.humanFeedback.outcome.replace(/_/g, ' ')}</span></div>
              <div><span className="text-slate-400">Reason: </span><span className="text-slate-700">{c.humanFeedback.justification}</span></div>
              <div><span className="text-slate-400">Investigator: </span><span className="text-slate-700">{c.humanFeedback.investigator}</span></div>
              <div><span className="text-slate-400">Timestamp: </span><span className="font-mono text-slate-700">{new Date(c.humanFeedback.recordedAt).toLocaleString()}</span></div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Case notes</h3>
            {c.investigatorNotes.map((n) => (
              <div key={n.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80"><div className="flex items-center justify-between"><span className="font-semibold text-slate-900">{n.author}</span><span className="text-[10px] text-slate-400">{new Date(n.timestamp).toLocaleDateString()}</span></div><p className="text-slate-600 mt-0.5">{n.content}</p></div>
            ))}
          </div>
        </div>
      )}

      {/* ===== AI BRIEF ===== */}
      {tab === 'AI_BRIEF' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Investigation Brief</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Generated by Groq from a verified evidence package. Every statement references evidence.</p>
            </div>
            <div className="flex items-center gap-2">
              {brief && <button onClick={handleCopyBrief} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"><Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}</button>}
              <button onClick={handleGenerateBrief} disabled={isGenerating} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"><Sparkles className="w-3.5 h-3.5" /> {isGenerating ? 'Generating...' : brief ? 'Regenerate' : 'Generate Brief'}</button>
            </div>
          </div>

          {brief ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 text-xs leading-relaxed text-slate-700">
              <section><span className="font-semibold text-slate-900 block mb-1">Executive summary</span><p className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">{brief.executiveSummary}</p></section>
              <section><span className="font-semibold text-slate-900 block mb-1">Risk interpretation</span><p className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">{brief.riskInterpretation}</p></section>
              <section>
                <span className="font-semibold text-slate-900 block mb-1">Strongest evidence</span>
                <div className="space-y-1.5">
                  {brief.keyEvidence.map((e) => (
                    <div key={e.evidenceId} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                      <span className="font-mono text-blue-700 font-semibold shrink-0 text-[11px]">{e.evidenceId}</span>
                      <div className="flex-1"><span className="text-slate-700">{e.finding}</span><span className="text-[10px] text-slate-500 block">{e.significance}</span></div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <section><span className="font-semibold text-slate-900 block mb-1">Financial exposure</span><p className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">{brief.financialImpact}</p></section>
                <section><span className="font-semibold text-slate-900 block mb-1">Member impact</span><p className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">{brief.memberImpact}</p></section>
              </div>
              <section>
                <span className="font-semibold text-slate-900 block mb-1">Future risk</span>
                <div className="grid grid-cols-3 gap-2">{brief.futureRisk.map((f) => <div key={f.horizon} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80"><span className="font-mono font-bold text-slate-800">{f.horizon}</span><p className="text-[11px] mt-0.5">{f.interpretation}</p></div>)}</div>
              </section>
              <section>
                <span className="font-semibold text-slate-900 block mb-1">Recommended human review</span>
                <ul className="space-y-1">{brief.recommendedActions.map((a, i) => <li key={i} className="flex items-start gap-2"><ArrowRight className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" /><span>{a.action}{a.evidenceIds?.length ? <span className="font-mono text-[10px] text-slate-400 ml-1">[{a.evidenceIds.join(', ')}]</span> : null}</span></li>)}</ul>
              </section>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                <span className="font-bold block mb-0.5">Confidence & limitations</span>
                <p>{brief.confidenceStatement}</p>
                <ul className="mt-1 list-disc list-inside">{(Array.isArray(brief.limitations) ? brief.limitations : [brief.limitations]).map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <p className="text-[10px] text-slate-400">{brief.modelVersion} · generated {brief.generatedAt ? new Date(brief.generatedAt).toLocaleString() : ''}</p>
            </div>
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-sm text-slate-500">
              Generate a structured, evidence-grounded investigation brief for case {c.id}.
            </div>
          )}
        </div>
      )}

      {/* ===== AUDIT ===== */}
      {tab === 'AUDIT' && (
        <div className="space-y-5">
        {/* Notification history — UI-only WhatsApp deep-link alerts (PREPARED, never Delivered) */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2"><Bot className="w-4 h-4" style={{ color: '#25D366' }} /> Notification history</span>
            <WhatsAppAlertButton caseRecord={c} />
          </div>
          {waHistory.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No WhatsApp alerts prepared for this case yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {waHistory.map((h) => (
                <div key={h.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">WhatsApp Alert</span>
                    <span className="text-[11px] text-slate-500 block">{h.caseId} · {h.recipientLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">PREPARED</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{new Date(h.preparedAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp alert history (Section 24) */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2"><Bot className="w-4 h-4 text-blue-600" /> WhatsApp alerts ({caseAlerts.length})</div>
          {caseAlerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No WhatsApp alerts generated for this case.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {caseAlerts.map((a) => (
                <div key={a.notificationId} className="p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{a.notificationType.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">To {a.investigatorName}{a.unassigned ? ' (duty officer — case unassigned)' : ''} · template {a.templateName}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                    {['QUEUED', 'SENT', 'DELIVERED', 'READ'].map((s) => {
                      const reached = a.history.some((h) => h.status === s) || a.status === s;
                      return (
                        <span key={s} className={`flex items-center gap-1 ${reached ? 'text-emerald-600 font-medium' : 'text-slate-300'}`}>
                          {reached ? '✓' : '○'} {s.charAt(0) + s.slice(1).toLowerCase()}
                        </span>
                      );
                    })}
                    {(a.status === 'FAILED' || a.status === 'DEAD_LETTER' || a.status === 'RETRYING') && (
                      <span className="text-rose-600 font-semibold">{a.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2"><ScrollText className="w-4 h-4 text-blue-600" /> Case audit trail ({caseAudit.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                <tr><th className="py-2.5 px-4">Time</th><th className="py-2.5 px-4">Actor</th><th className="py-2.5 px-4">Event</th><th className="py-2.5 px-4">Hash</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {[...caseAudit].reverse().map((b) => (
                  <tr key={b.eventId} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-slate-500">{new Date(b.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-4 text-slate-800">{b.actor}</td>
                    <td className="py-2.5 px-4"><span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{b.eventType}</span> <span className="text-slate-500">{b.details}</span></td>
                    <td className="py-2.5 px-4 font-mono text-slate-900">{b.hash.slice(0, 8)}</td>
                  </tr>
                ))}
                {caseAudit.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-500 text-xs">No audit events recorded for this case yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};
