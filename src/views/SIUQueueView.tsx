import React, { useMemo, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { RECOMMENDATION_META, SIURecommendation } from '../services/siuRecommendationService';
import { StatCard } from '../components/common/UI';
import { WhatsAppAlertButton } from '../components/notifications/WhatsAppAlertButton';
import { Inbox, Users, Sliders, AlertTriangle, ArrowRight } from 'lucide-react';

const KpiCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; tone?: 'default' | 'rose' | 'amber' | 'emerald' | 'purple' | 'blue' }> = ({
  label,
  value,
  sub,
  tone = 'default',
}) => <StatCard label={label} value={value} sub={sub} tone={tone} />;

export const SIUQueueView: React.FC = () => {
  const { siuQueue, capacityConfig, setCapacityConfig, openCase } = useNexus();
  const { metrics, scored } = siuQueue;

  const [recFilter, setRecFilter] = useState<SIURecommendation | 'ALL'>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => (recFilter === 'ALL' ? scored : scored.filter((c) => c.siuScore.recommendation === recFilter)),
    [scored, recFilter],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-8 max-w-[90rem] mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">SIU Queue</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Capacity-aware investigation prioritization</p>
        </div>

        {/* Capacity planner */}
        <div className="flex items-center gap-4 p-2.5 bg-white border border-slate-200 rounded-xl text-xs">
          <Sliders className="w-4 h-4 text-blue-600" />
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Investigators</span>
            <input
              type="number"
              min={1}
              max={50}
              value={capacityConfig.investigatorsCount}
              onChange={(e) => setCapacityConfig({ ...capacityConfig, investigatorsCount: Math.max(1, Number(e.target.value) || 1) })}
              className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center font-medium focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Cases / investigator / wk</span>
            <input
              type="number"
              min={1}
              max={20}
              value={capacityConfig.casesPerInvestigator}
              onChange={(e) => setCapacityConfig({ ...capacityConfig, casesPerInvestigator: Math.max(1, Number(e.target.value) || 1) })}
              className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-center font-medium focus:outline-none focus:border-blue-500"
            />
          </label>
        </div>
      </div>

      {/* KPI cards (Section 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Investigators" value={metrics.investigators} sub={`cap ${metrics.totalCapacity}/wk`} tone="blue" />
        <KpiCard label="Active Cases" value={metrics.activeCases} />
        <KpiCard label="In Capacity" value={metrics.inCapacityCases} tone="emerald" />
        <KpiCard label="Over Capacity" value={metrics.overCapacityCases} tone="rose" />
        <KpiCard label="Must-Take" value={metrics.mustTakeCases} tone="rose" />
        <KpiCard label="Deferred" value={metrics.deferredCases} tone="amber" />
        <KpiCard label="Weeks to Clear" value={metrics.weeksToClear} />
        <KpiCard label="Due ≤ 7 Days" value={metrics.casesDueWithin7Days} tone="rose" />
      </div>

      {/* Over-capacity warning (Section 4 reference) */}
      {metrics.mustTakeCases > metrics.totalCapacity && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>
            {metrics.mustTakeCases} must-take cases exceed this week's capacity of {metrics.totalCapacity}. Escalate for
            additional investigator allocation.
          </span>
        </div>
      )}

      {/* Workload summary strip */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> Estimated workload: <strong className="font-mono text-slate-900">{metrics.estimatedWorkloadHours}h</strong></span>
        <span>Recommended: <strong className="font-mono text-blue-700">{metrics.recommendedCases}</strong></span>
        <span>Monitor: <strong className="font-mono text-slate-700">{metrics.monitorCases}</strong></span>
        {selected.size > 0 && <span className="ml-auto text-blue-700 font-semibold">{selected.size} selected</span>}
      </div>

      {/* Recommendation filter chips */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setRecFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${recFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          All ({scored.length})
        </button>
        {(Object.keys(RECOMMENDATION_META) as SIURecommendation[]).map((rec) => {
          const count = scored.filter((c) => c.siuScore.recommendation === rec).length;
          const meta = RECOMMENDATION_META[rec];
          return (
            <button
              key={rec}
              onClick={() => setRecFilter(rec)}
              className={`px-2.5 py-1 rounded-lg border font-medium transition-colors flex items-center gap-1.5 ${recFilter === rec ? meta.className : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Capacity-ranked table (Section 6) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
              <tr>
                <th className="py-3 px-3 w-8"></th>
                <th className="py-3 px-3">Case</th>
                <th className="py-3 px-3">Target Entity</th>
                <th className="py-3 px-3">Recommendation</th>
                <th className="py-3 px-3 text-center">Priority</th>
                <th className="py-3 px-3 text-center">Confidence</th>
                <th className="py-3 px-3 text-center">Evidence</th>
                <th className="py-3 px-3 text-center">Risk</th>
                <th className="py-3 px-3 text-right">Exposure</th>
                <th className="py-3 px-3 text-center">Member Impact</th>
                <th className="py-3 px-3">Deadline</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const meta = RECOMMENDATION_META[c.siuScore.recommendation];
                const detectorTypes = c.evidenceTypes?.length || new Set(c.evidenceBreakdown.map((e) => e.ruleName)).size;
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50/80 transition-colors ${c.siuScore.recommendation === 'MUST_TAKE' ? 'bg-rose-50/30' : ''}`}
                  >
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="accent-blue-600"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                      {c.id}
                      <span className="text-[10px] text-slate-400 block font-sans">#{c.siuScore.rank}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{c.targetName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{c.targetId}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${meta.className}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{c.priorityScore}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">{c.siuScore.confidence.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-mono font-semibold text-slate-700">{c.evidenceBreakdown.length}</span>
                      <span className="text-[10px] text-slate-400 block">{detectorTypes} types</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${c.riskScore >= 85 ? 'bg-rose-50 text-rose-700' : c.riskScore >= 70 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                        {c.riskScore}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">${c.estimatedExposure.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">{c.affectedMembersCount}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-medium ${c.siuScore.deadlineUrgent ? 'text-rose-700' : 'text-slate-600'}`}>
                        Due in {c.siuScore.deadlineDays}d
                      </span>
                    </td>
                    <td className="py-2.5 px-3"><StatusBadge status={c.status} /></td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <WhatsAppAlertButton caseRecord={c} variant="icon" />
                        <button
                          onClick={() => openCase(c.id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition-colors inline-flex items-center gap-1"
                        >
                          Open <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={13} className="py-10 text-center text-slate-500 text-xs">No cases in this disposition.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Recommendations combine priority, exposure, member impact, evidence strength, severity, network risk and
        investigator capacity against each case's derived compliance deadline. Risk is not proof; every disposition
        requires human review.
      </p>
    </div>
  );
};
