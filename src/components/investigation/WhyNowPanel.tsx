import React from 'react';
import {
  TrendingUp,
  Zap,
  ArrowUpRight,
  Share2,
} from 'lucide-react';

interface WhyNowPanelProps {
  claimVelocityChange: number;
  highValueClaimSpike: number;
  referralDensityChange: number;
  networkEntitiesAdded: number;
  riskDelta30d: number;
  risk30dAgo?: number;
  riskToday?: number;
}

export const WhyNowPanel: React.FC<WhyNowPanelProps> = ({
  claimVelocityChange = 41,
  highValueClaimSpike = 58,
  referralDensityChange = 27,
  networkEntitiesAdded = 2,
  riskDelta30d = 36,
  risk30dAgo = 58,
  riskToday = 94,
}) => {
  return (
    <div className="p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
            Why Review Now? Key Changes in the Past 30 Days
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">30 days ago: {risk30dAgo}</span>
          <span className="text-slate-300">→</span>
          <span className="text-rose-700 font-bold">Today: {riskToday}</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold ml-1">
            +{riskDelta30d} pts
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Daily Claim Submissions</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-rose-700">
              +{claimVelocityChange}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Jumped from 9 to 28 daily claims
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Expensive Procedure Codes</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-rose-700">
              +{highValueClaimSpike}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Level 5 visits & surgical injections
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Referrals to One Partner</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-amber-700">
              +{referralDensityChange}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            78% sent directly to Dr. Chen
          </span>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>New Connected Locations</span>
            <Share2 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-blue-700">
              +{networkEntitiesAdded} Clinics
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Apex Pavilion & Centinela Surgical
          </span>
        </div>
      </div>
    </div>
  );
};
