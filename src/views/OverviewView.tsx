import React, { useMemo } from 'react';
import { useNexus } from '../store/useNexusStore';
import { RiskBadge } from '../components/common/RiskBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { HIGH_PRIORITY_THRESHOLD } from '../types';
import { RiskTrajectoryChart } from '../components/analytics/AnalyticalCharts';
import { PageHeader, StatCard } from '../components/common/UI';
import { WhatsAppAlertButton } from '../components/notifications/WhatsAppAlertButton';
import {
  AlertCircle,
  TrendingUp,
  DollarSign,
  Network,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';

export const OverviewView: React.FC = () => {
  const {
    cases,
    claims,
    networks,
    currentProvider,
    timelinePoints,
    openCase,
    setActiveTab,
  } = useNexus();

  // 1. What needs attention?
  const highPriorityCases = useMemo(() => {
    return cases.filter((c) => c.priorityScore >= HIGH_PRIORITY_THRESHOLD);
  }, [cases]);

  // 2. What's changing?
  // Derived from claims velocity / flagged trend
  const historicalPoints = timelinePoints.filter((point) => !point.isFuture);
  const firstRisk = historicalPoints[0]?.riskScore;
  const latestRisk = historicalPoints.at(-1)?.riskScore;
  const riskChange = firstRisk !== undefined && latestRisk !== undefined ? latestRisk - firstRisk : undefined;
  const hasTrend = currentProvider && historicalPoints.length >= 2 && riskChange !== undefined;
  const riskVelocityText = hasTrend ? `${currentProvider.id} risk ${riskChange >= 0 ? 'increasing' : 'decreasing'}` : 'Trend unavailable';
  const riskVelocitySub = hasTrend ? `${firstRisk} → ${latestRisk} risk across ${historicalPoints.length} observed periods` : 'Insufficient historical data';

  // 3. What's financially exposed?
  const totalExposure = useMemo(() => {
    const activeCases = cases.filter((investigation) => ['NEW', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED', 'FIELD_INTERVIEW', 'REFERRED_TO_LEGAL'].includes(investigation.status));
    const suspiciousClaimIds = new Set(activeCases.flatMap((investigation) => investigation.claimIds || []));
    return claims.filter((claim) => suspiciousClaimIds.has(claim.id)).reduce((sum, claim) => sum + claim.billedAmount, 0);
  }, [cases, claims]);

  const formattedExposure =
    totalExposure >= 1000000
      ? `$${(totalExposure / 1000000).toFixed(2)}M`
      : `$${totalExposure.toLocaleString()}`;

  // 4. What's the biggest emerging network?
  const topNetwork = useMemo(() => {
    const sorted = [...networks].sort((a, b) => b.riskScore - a.riskScore);
    return sorted[0];
  }, [networks]);

  const handleOpenTopInvestigation = () => {
    if (cases.length > 0) {
      openCase(cases[0].id);
    } else {
      setActiveTab('SIU_QUEUE');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-150">
      <PageHeader
        title="Overview"
        subtitle="Operational status of healthcare claims, emerging provider risk, and priority SIU queues."
        actions={
          <button
            onClick={handleOpenTopInvestigation}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{cases.length > 0 ? `Open Investigation (${cases[0].id})` : 'Open Investigations'}</span>
          </button>
        }
      />

      {/* The 4 Operational Questions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard tone="rose" label="Needs Attention" mono={false} icon={<AlertCircle className="w-4 h-4" />}
          value={`${highPriorityCases.length} High-Priority`} sub="Awaiting SIU review & decision" />
        <StatCard tone="amber" label="What's Changing" mono={false} icon={<TrendingUp className="w-4 h-4" />}
          value={riskVelocityText} sub={riskVelocitySub} />
        <StatCard tone="blue" label="Suspicious Exposure" icon={<DollarSign className="w-4 h-4" />}
          value={formattedExposure} sub="Claims linked to verified evidence" />
        <StatCard tone="purple" label="Emerging Network" icon={<Network className="w-4 h-4" />}
          value={topNetwork ? `${topNetwork.id}` : 'None'} sub={topNetwork ? `Risk ${topNetwork.riskScore} · ${topNetwork.name}` : 'Appears after ingestion'} />
      </div>

      <div className="mt-6">
        <RiskTrajectoryChart riskState={currentProvider?.riskState} providerId={currentProvider?.id} />
      </div>

      {/* Priority Cases Table */}
      <div className="mt-6 cs-card cs-card-hover overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Priority Cases
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Ranked by analytical risk severity, evidence strength, and financial exposure.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('SIU_QUEUE')}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>View SIU Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
              <tr>
                <th className="py-3 px-4">Case</th>
                <th className="py-3 px-4">Entity / Provider</th>
                <th className="py-3 px-4 text-center">Risk</th>
                <th className="py-3 px-4 text-center">Evidence</th>
                <th className="py-3 px-4 text-right">Exposure</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.slice(0, 5).map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openCase(c.id)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                    <span className="group-hover:text-blue-600 transition-colors">
                      {c.id}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800">{c.targetName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{c.targetId} • {c.specialty || 'Specialty'}</div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      c.riskScore >= 85
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : c.riskScore >= 70
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {c.riskScore}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono">
                    <span className="font-semibold text-slate-700">{c.evidenceStrength}%</span>
                    <span className="text-[10px] text-slate-400 block">
                          {c.evidenceBreakdown.length} signals · {c.evidenceTypes?.length || new Set(c.evidenceBreakdown.map((item) => item.ruleName)).size} types
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                    ${c.estimatedExposure.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <WhatsAppAlertButton caseRecord={c} variant="icon" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openCase(c.id);
                        }}
                        className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-xs border border-blue-200/60 transition-colors"
                      >
                        Open Case
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
