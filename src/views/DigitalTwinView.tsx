import React, { useMemo } from 'react';
import { useNexus } from '../store/useNexusStore';
import { DigitalTwinTimeline } from '../components/digitaltwin/DigitalTwinTimeline';
import { DigitalTwinTimelinePoint } from '../types';
import { Boxes, ArrowRight } from 'lucide-react';

export const DigitalTwinView: React.FC = () => {
  const { currentProvider, timelinePoints, timelineIndex, setTimelineIndex, cases, openCase } = useNexus();

  const p = currentProvider;

  // Compose observed timeline + forecast points for the full historical->forecast progression.
  const fullTimeline: DigitalTwinTimelinePoint[] = useMemo(() => {
    const observed = timelinePoints.filter((t) => !t.isFuture);
    if (!p || observed.length === 0) return observed;
    const lastObserved = observed[observed.length - 1];
    const forecastPoints: DigitalTwinTimelinePoint[] = [
      { horizon: '30D Forecast', offset: 30, risk: p.forecast30d },
      { horizon: '60D Forecast', offset: 60, risk: p.forecast60d },
      { horizon: '90D Forecast', offset: 90, risk: p.forecast90d },
    ]
      .filter((f) => f.risk > 0)
      .map((f) => ({
        periodLabel: f.horizon,
        daysOffset: f.offset,
        isFuture: true,
        riskScore: f.risk,
        claimVolume: lastObserved.claimVolume,
        networkDegree: lastObserved.networkDegree,
        estimatedExposure: f.offset === 30 ? p.projectedExposure30d : f.offset === 60 ? p.projectedExposure60d : p.projectedExposure90d,
        referralDensity: lastObserved.referralDensity,
        anomalyScore: lastObserved.anomalyScore,
        summaryNote: `Projected state at ${f.horizon} based on observed trajectory. Forecast, not a guarantee.`,
      }));
    return [...observed, ...forecastPoints];
  }, [timelinePoints, p]);

  const providerCase = cases.find((c) => c.providerId === p?.id);

  if (!p || timelinePoints.length === 0) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
          <Boxes className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Digital Twin</h1>
        </div>
        <div className="mt-8 p-8 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-500">
          A digital twin requires at least two observed claim periods for the top-risk provider. Current dataset has
          insufficient history.
        </div>
      </div>
    );
  }

  const stateMetrics = [
    { label: 'Claims velocity', value: `${p.claimsCount} claims` },
    { label: 'Utilization', value: `${p.memberCount} members` },
    { label: 'Referral concentration', value: `${Math.round((p.referralDensity || 0) * 100)}%` },
    { label: 'Network connectivity', value: `${p.connectedFacilityIds.length} facilities` },
    { label: 'Financial exposure', value: `$${(p.suspiciousExposure || 0).toLocaleString()}` },
    { label: 'Risk', value: `${p.riskScore}` },
    { label: 'Evidence strength', value: `${p.evidenceStrength}%` },
  ];

  return (
    <div className="p-8 max-w-[88rem] mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Digital Twin</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Behavioral digital twin for {p.name} ({p.id}) — historical state through 90-day forecast.
          </p>
        </div>
        {providerCase && (
          <button onClick={() => openCase(providerCase.id)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">
            Open case {providerCase.id} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Provider state snapshot (Section 17) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">Current provider state</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {stateMetrics.map((m) => (
            <div key={m.label} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">{m.label}</span>
              <span className="text-base font-bold font-mono text-slate-900">{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      <DigitalTwinTimeline
        points={fullTimeline}
        selectedIndex={Math.min(timelineIndex, fullTimeline.length - 1)}
        onSelectIndex={setTimelineIndex}
        entityName={`${p.name} (${p.id})`}
      />

      <p className="text-[11px] text-slate-400">
        Twin projections reflect mathematical modeling of observed billing rates. They do not guarantee future claim
        volume or establish provider intent.
      </p>
    </div>
  );
};
