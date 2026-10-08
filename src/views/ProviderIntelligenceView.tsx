import React, { useMemo, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { RiskScoreGauge, RiskBadge } from '../components/common/RiskBadge';
import { RiskTrajectoryChart } from '../components/analytics/AnalyticalCharts';
import { PageHeader } from '../components/common/UI';
import { Stethoscope, Search, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
    <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">{label}</span>
    <span className="text-lg font-bold font-mono text-slate-900">{value}</span>
    {sub && <span className="text-[10px] text-slate-400 block">{sub}</span>}
  </div>
);

export const ProviderIntelligenceView: React.FC = () => {
  const { providers, currentProvider, selectedProviderId, setSelectedProviderId, cases, openCase, evidenceRecords } = useNexus();
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return providers.filter((p) => q === '' || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [providers, search]);

  const p = currentProvider;
  if (!p) {
    return <div className="p-8 text-sm text-slate-500">No providers in the current dataset.</div>;
  }

  const providerCase = cases.find((c) => c.providerId === p.id);
  const providerEvidence = evidenceRecords.filter((e) => e.entityId === p.id);
  const trendIcon = p.trendDirection === 'UP' ? <TrendingUp className="w-3.5 h-3.5 text-rose-600" /> : p.trendDirection === 'DOWN' ? <TrendingDown className="w-3.5 h-3.5 text-emerald-600" /> : <Minus className="w-3.5 h-3.5 text-slate-400" />;

  return (
    <div className="p-8 max-w-[88rem] mx-auto animate-in fade-in duration-150">
      <PageHeader icon={<Stethoscope className="w-5 h-5" />} title="Provider Intelligence" subtitle="Provider profile, risk trajectory, peer comparison, behavior and forecast." />


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Provider list */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search provider..." className="w-full bg-transparent focus:outline-none text-slate-800 placeholder-slate-400" />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {list.map((prov) => (
              <button
                key={prov.id}
                onClick={() => setSelectedProviderId(prov.id)}
                className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between ${selectedProviderId === prov.id || p.id === prov.id ? 'bg-blue-50/60' : ''}`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-sm truncate">{prov.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{prov.id} · {prov.specialty}</div>
                </div>
                <span className={`font-mono font-bold text-sm shrink-0 ${prov.riskScore >= 85 ? 'text-rose-700' : prov.riskScore >= 70 ? 'text-amber-700' : 'text-slate-600'}`}>{prov.riskScore}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Provider profile */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{p.name}</h2>
                <p className="text-xs text-slate-500 font-mono">{p.id} · NPI {p.npi || '—'} · {p.specialty}</p>
                <div className="mt-2 flex items-center gap-2">
                  <RiskBadge level={p.riskLevel} score={p.riskScore} />
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">{trendIcon} {p.trendDelta30d >= 0 ? '+' : ''}{p.trendDelta30d} over 30 days</span>
                </div>
              </div>
              <RiskScoreGauge score={p.riskScore} size="lg" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <Stat label="Claims" value={p.claimsCount} />
              <Stat label="Total billed" value={`$${p.totalBilled.toLocaleString()}`} />
              <Stat label="Suspicious exposure" value={`$${(p.suspiciousExposure || 0).toLocaleString()}`} />
              <Stat label="Members" value={p.memberCount} sub={`${p.affectedMembers || 0} affected`} />
              <Stat label="Evidence strength" value={`${p.evidenceStrength}%`} sub={`${providerEvidence.length} records`} />
              <Stat label="Network risk" value={p.networkRiskScore} sub={p.networkId || 'no network'} />
              <Stat label="Peer deviation" value={`${(p.peerDeviationFactor || 0).toFixed(1)}x`} />
              <Stat label="SIU status" value={p.siuStatus?.replace(/_/g, ' ') || '—'} />
            </div>
          </div>

          {/* Risk trajectory */}
          <RiskTrajectoryChart riskState={p.riskState} providerId={p.id} />

          {/* Peer comparison */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Peer comparison</h3>
            {p.peerComparisons.map((pc, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{pc.metric}</span>
                  <span className="font-mono text-slate-800"><strong>{pc.providerVal}{pc.unit}</strong> vs peer {pc.peerVal}{pc.unit} ({pc.ratio}x)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="h-full bg-rose-500" style={{ width: `${Math.min(70, pc.providerVal)}%` }} />
                  <div className="h-full bg-slate-300" style={{ width: `${Math.min(30, pc.peerVal)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Top procedures + forecast */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">Top procedures</h3>
              <div className="space-y-1.5 text-xs">
                {p.topProcedures.slice(0, 6).map((tp) => (
                  <div key={tp.code} className="flex items-center justify-between">
                    <span className="font-mono text-blue-700">CPT {tp.code}</span>
                    <span className="text-slate-600">{tp.count} claims · <span className="font-mono text-slate-900">${tp.billed.toLocaleString()}</span></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">Risk forecast</h3>
              {p.forecast30d > 0 ? (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200"><span className="text-[10px] text-slate-400 block">30D</span><span className="font-mono font-bold text-slate-900">{p.forecast30d}</span></div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200"><span className="text-[10px] text-slate-400 block">60D</span><span className="font-mono font-bold text-amber-600">{p.forecast60d}</span></div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200"><span className="text-[10px] text-slate-400 block">90D</span><span className="font-mono font-bold text-rose-600">{p.forecast90d}</span></div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Insufficient history for a forecast.</p>
              )}
              <p className="text-[10px] text-slate-400 mt-2">Forecast confidence {p.forecastConfidence}%. Forecast is not a certainty.</p>
            </div>
          </div>

          {providerCase && (
            <button onClick={() => openCase(providerCase.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">
              Open investigation case {providerCase.id} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
