import React, { useState } from 'react';
import { EvidenceItem } from '../../types';
import { RiskBadge } from '../common/RiskBadge';
import {
  ShieldAlert,
  ChevronRight,
  FileCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface EvidenceWaterfallProps {
  evidenceItems: EvidenceItem[];
  totalScore: number;
  caseId: string;
}

export const EvidenceWaterfall: React.FC<EvidenceWaterfallProps> = ({
  evidenceItems,
  totalScore,
  caseId,
}) => {
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(
    evidenceItems[0] || null
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
            Why This Case Was Flagged — Evidence Breakdown
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Total Risk Score:</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold font-mono">
            {totalScore}/100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Waterfall List (Left 7 cols) */}
        <div className="lg:col-span-7 space-y-2">
          {evidenceItems.map((item) => {
            const isSelected = selectedEvidence?.id === item.id;
            const barWidth = Math.min(100, (item.contributionScore / 25) * 100);

            return (
              <div
                key={item.id}
                onClick={() => setSelectedEvidence(item)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-400 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs font-mono font-medium text-slate-500">
                      {item.ruleId}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs shrink-0 font-medium">
                    <span className="text-rose-700 font-mono">
                      +{item.contributionScore} pts
                    </span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isSelected ? 'rotate-90 text-blue-600' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Evidence Deep Dive (Right 5 cols) */}
        <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
          {selectedEvidence ? (
            <>
              <div className="flex items-start justify-between pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                      {selectedEvidence.id}
                    </span>
                    <RiskBadge level={selectedEvidence.severity} showScore={false} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">
                    {selectedEvidence.title}
                  </h4>
                  <span className="text-xs text-blue-700 font-medium">
                    Rule {selectedEvidence.ruleId}: {selectedEvidence.ruleName}
                  </span>
                </div>
              </div>

              {/* Observed Fact vs Inference */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                    <FileCheck className="w-3.5 h-3.5" />
                    Observed Billing Record (Verified Fact)
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {selectedEvidence.observedFact}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Statistical Detection (What Was Found)
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {selectedEvidence.modelInference}
                  </p>
                </div>
              </div>

              {/* Supporting Record IDs */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                  Supporting Claim Records
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEvidence.supportingRecordIds.map((recId) => (
                    <span
                      key={recId}
                      className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-700 font-mono text-xs flex items-center gap-1 hover:border-slate-300 transition-colors"
                    >
                      {recId}
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Select an item on the left to see supporting claims.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
