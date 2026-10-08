import React, { useMemo, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { PolicyThresholds, shortHash } from '../services/policyService';
import { ShieldCheck, Save, Eye, GitCommitHorizontal } from 'lucide-react';

const ThresholdSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}> = ({ label, value, onChange, min = 0, max = 100 }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-600 font-medium">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-16 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-center font-mono font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
      />
    </div>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-600" />
  </div>
);

export const PolicyView: React.FC = () => {
  const { activePolicy, policyVersions, previewPolicyImpact, savePolicyVersion, cases } = useNexus();

  const [draft, setDraft] = useState<PolicyThresholds>({ ...activePolicy.thresholds });
  const [reason, setReason] = useState('');
  const [author, setAuthor] = useState('SIU Policy Lead');
  const [previewed, setPreviewed] = useState(false);

  const currentEligible = useMemo(() => cases.length, [cases]);
  const proposedImpact = useMemo(() => previewPolicyImpact(draft), [draft, previewPolicyImpact]);

  const changed = useMemo(
    () => (Object.keys(draft) as (keyof PolicyThresholds)[]).some((k) => draft[k] !== activePolicy.thresholds[k]),
    [draft, activePolicy.thresholds],
  );

  const reductionPct = currentEligible > 0 ? Math.round(((currentEligible - proposedImpact.eligibleCount) / currentEligible) * 100) : 0;

  const handleSave = () => {
    if (!reason.trim() || !changed) return;
    savePolicyVersion(draft, reason.trim(), author.trim() || 'SIU Policy Lead');
    setReason('');
    setPreviewed(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Policy</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">Models propose, this policy constrains, a human decides. Every version is hashed into the ledger.</p>
      </div>

      {/* Active version summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Active version</span>
          <span className="text-2xl font-bold font-mono text-slate-900">{activePolicy.version}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Policy hash</span>
          <span className="text-sm font-bold font-mono text-blue-700">{shortHash(activePolicy.hash, 10)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Author</span>
          <span className="text-sm font-semibold text-slate-900">{activePolicy.author}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">Effective</span>
          <span className="text-sm font-semibold text-slate-900">{new Date(activePolicy.effectiveDate).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Model / forecast / AI version transparency */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-x-8 gap-y-2 text-xs">
        <span className="text-slate-500">Model version: <strong className="font-mono text-slate-800">{activePolicy.modelVersion}</strong></span>
        <span className="text-slate-500">Forecast model: <strong className="font-mono text-slate-800">{activePolicy.forecastModel}</strong></span>
        <span className="text-slate-500">AI model: <strong className="font-mono text-slate-800">{activePolicy.aiModel}</strong></span>
      </div>

      {/* Threshold editor + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Key thresholds</h2>
          <ThresholdSlider label="SIU risk score floor" value={draft.riskThreshold} onChange={(v) => { setDraft({ ...draft, riskThreshold: v }); setPreviewed(false); }} />
          <ThresholdSlider label="Evidence strength floor" value={draft.evidenceThreshold} onChange={(v) => { setDraft({ ...draft, evidenceThreshold: v }); setPreviewed(false); }} />
          <ThresholdSlider label="Network risk threshold" value={draft.networkRiskThreshold} onChange={(v) => { setDraft({ ...draft, networkRiskThreshold: v }); setPreviewed(false); }} />
          <ThresholdSlider label="High-severity evidence floor" value={draft.highSeverityEvidenceThreshold} onChange={(v) => { setDraft({ ...draft, highSeverityEvidenceThreshold: v }); setPreviewed(false); }} />
          <button
            onClick={() => setPreviewed(true)}
            disabled={!changed}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Preview Impact
          </button>
        </div>

        <div className="lg:col-span-5 space-y-4">
          {/* Impact preview */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Projected impact</h2>
            {previewed && changed ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Current SIU cases</span>
                  <span className="font-mono font-bold text-slate-900">{currentEligible}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Proposed SIU-eligible</span>
                  <span className="font-mono font-bold text-blue-700">{proposedImpact.eligibleCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Change</span>
                  <span className={`font-mono font-bold ${reductionPct > 0 ? 'text-emerald-700' : reductionPct < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                    {reductionPct > 0 ? `${reductionPct}% reduction` : reductionPct < 0 ? `${Math.abs(reductionPct)}% increase` : 'No change'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400">Adjust thresholds and press Preview Impact to recompute SIU-eligible providers against the live dataset. No change is persisted until you save a new version.</p>
            )}
          </div>

          {/* Save new version */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Save as new version</h2>
            <input
              type="text"
              placeholder="Change reason (e.g. reduce low-confidence SIU volume)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={!changed || !reason.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save New Version
            </button>
            <p className="text-[10px] text-slate-400">Creates an immutable, hashed version linked to the previous policy hash.</p>
          </div>
        </div>
      </div>

      {/* Version history */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-800">Version history</div>
        <div className="divide-y divide-slate-100">
          {[...policyVersions].reverse().map((v) => (
            <div key={v.version} className="p-4 flex items-start gap-3 text-xs">
              <GitCommitHorizontal className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{v.version}</span>
                  <span className="font-mono text-[10px] text-slate-400">{shortHash(v.hash, 10)}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{v.author}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{new Date(v.effectiveDate).toLocaleString()}</span>
                </div>
                <p className="text-slate-600 mt-0.5">{v.reason}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 text-[10px] font-mono text-slate-500">
                  <span>Risk {v.thresholds.riskThreshold}</span>
                  <span>Evidence {v.thresholds.evidenceThreshold}</span>
                  <span>Network {v.thresholds.networkRiskThreshold}</span>
                  <span>High-sev {v.thresholds.highSeverityEvidenceThreshold}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
