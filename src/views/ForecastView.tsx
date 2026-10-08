import React, { useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { TrendingUp, Play, Beaker } from 'lucide-react';
import { ForecastChart } from '../components/analytics/AnalyticalCharts';
import { PageHeader, Card, SectionTitle, Pill, Bar } from '../components/common/UI';

const SliderRow: React.FC<{ label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string }> = ({ label, value, onChange, min, max, suffix = '%' }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono font-semibold text-blue-700">{value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-600" />
  </div>
);

export const ForecastView: React.FC = () => {
  const { currentProvider, currentCase, simulationResult, simulationParams, updateSimulationParams, providers } = useNexus();
  const p = currentProvider;
  const [ran, setRan] = useState(false);

  if (!p) return <div className="p-8 text-sm text-slate-500">No provider data available.</div>;

  const observed = [{ label: 'Current', value: p.riskScore }];
  const forecast = [
    { label: '30D', value: p.forecast30d },
    { label: '60D', value: p.forecast60d },
    { label: '90D', value: p.forecast90d },
  ].filter((f) => f.value > 0);

  const topRiskProviders = [...providers].sort((a, b) => b.forecast90d - a.forecast90d).slice(0, 6);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-150">
      <PageHeader
        icon={<TrendingUp className="w-5 h-5" />}
        title="Risk Forecast"
        subtitle={`Observed risk and 30/60/90-day projections for ${p.name} (${p.id}). Forecast is never presented as certainty.`}
      />

      <div className="space-y-6">
      {/* Forecast chart */}
      <Card className="p-5 space-y-4">
        <SectionTitle
          icon={<TrendingUp className="w-4 h-4" />}
          right={
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-blue-600 inline-block rounded-full" /> Observed</span>
              <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-rose-500 inline-block" /> Forecast</span>
            </div>
          }
        >
          Risk forecast
        </SectionTitle>
        <ForecastChart observed={observed} forecast={forecast} />
        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">Current</span><span className="text-xl font-bold font-mono text-slate-900">{p.riskScore}</span></div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">30D</span><span className="text-xl font-bold font-mono text-slate-900">{p.forecast30d || '—'}</span></div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">60D</span><span className="text-xl font-bold font-mono text-amber-600">{p.forecast60d || '—'}</span></div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200"><span className="text-[10px] text-slate-400 uppercase block">90D</span><span className="text-xl font-bold font-mono text-rose-600">{p.forecast90d || '—'}</span></div>
        </div>
        <p className="text-[11px] text-slate-400">Forecast confidence {p.forecastConfidence}%. Projections model observed trajectory and may not reflect future behavior.</p>
      </Card>

      {/* Scenario Simulator (Section 19) */}
      <Card className="p-5 space-y-4">
        <SectionTitle
          icon={<Beaker className="w-4 h-4" />}
          right={<Pill tone="purple">Simulated scenario — not a guarantee</Pill>}
        >
          Scenario Simulator
        </SectionTitle>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <SliderRow label="Claim growth" value={simulationParams.claimGrowthPercent} onChange={(v) => { updateSimulationParams({ claimGrowthPercent: v }); setRan(false); }} min={0} max={100} />
            <SliderRow label="Referral concentration" value={simulationParams.referralGrowthPercent} onChange={(v) => { updateSimulationParams({ referralGrowthPercent: v }); setRan(false); }} min={0} max={100} />
            <SliderRow label="High-value claim rate" value={simulationParams.highValueSpikePercent} onChange={(v) => { updateSimulationParams({ highValueSpikePercent: v }); setRan(false); }} min={0} max={100} />
            <SliderRow label="Network expansion" value={simulationParams.networkExpansionCount} onChange={(v) => { updateSimulationParams({ networkExpansionCount: v }); setRan(false); }} min={0} max={10} suffix=" nodes" />
            <SliderRow label="Investigation intervention" value={simulationParams.interventionIntensityPercent} onChange={(v) => { updateSimulationParams({ interventionIntensityPercent: v }); setRan(false); }} min={0} max={100} />
            <button onClick={() => setRan(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors">
              <Play className="w-3.5 h-3.5" /> Run Scenario
            </button>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Baseline (no intervention)</span>
              <div className="text-center py-2">
                <span className="text-[10px] text-slate-400 uppercase block">90D Risk</span>
                <span className="text-4xl font-bold font-mono text-rose-700">{simulationResult.scenarioA.risk90d}</span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between"><span>30D / 60D</span><span className="font-mono">{simulationResult.scenarioA.risk30d} / {simulationResult.scenarioA.risk60d}</span></div>
                <div className="flex justify-between"><span>Exposure 90D</span><span className="font-mono">${simulationResult.scenarioA.exposure90d.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Simulated intervention</span>
              <div className="text-center py-2">
                <span className="text-[10px] text-slate-400 uppercase block">90D Risk</span>
                <span className="text-4xl font-bold font-mono text-emerald-700">{simulationResult.scenarioB.risk90d}</span>
              </div>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <div className="flex justify-between"><span>30D / 60D</span><span className="font-mono">{simulationResult.scenarioB.risk30d} / {simulationResult.scenarioB.risk60d}</span></div>
                <div className="flex justify-between"><span>Exposure 90D</span><span className="font-mono">${simulationResult.scenarioB.exposure90d.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="sm:col-span-2 p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600">Projected 90-day risk difference</span>
              <span className="text-lg font-bold font-mono text-emerald-700">
                {simulationResult.scenarioB.risk90d - simulationResult.scenarioA.risk90d}
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          The simulation engine computes these values deterministically from {currentCase?.id ? `case ${currentCase.id}'s` : "the provider's"} current
          state. The AI layer only explains results — it never calculates them.
        </p>
      </Card>

      {/* Portfolio forecast leaderboard */}
      <Card className="p-5">
        <SectionTitle icon={<TrendingUp className="w-4 h-4" />}>Highest projected 90-day risk</SectionTitle>
        <div className="space-y-2.5">
          {topRiskProviders.map((prov) => (
            <div key={prov.id} className="flex items-center gap-3 text-xs">
              <span className="w-28 font-mono text-slate-700 truncate">{prov.id}</span>
              <Bar value={prov.forecast90d} tone="rose" className="flex-1" />
              <span className="font-mono font-semibold text-slate-900 w-20 text-right">{prov.riskScore} → {prov.forecast90d || '—'}</span>
            </div>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
};
