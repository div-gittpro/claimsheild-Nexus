import React from 'react';
import { DigitalTwinTimelinePoint } from '../../types';
import { RiskScoreGauge } from '../common/RiskBadge';
import { Clock, TrendingUp } from 'lucide-react';

interface DigitalTwinTimelineProps {
  points: DigitalTwinTimelinePoint[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  entityName?: string;
}

const pct = (now: number, then: number) => (then === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - then) / then) * 100));

export const DigitalTwinTimeline: React.FC<DigitalTwinTimelineProps> = ({
  points,
  selectedIndex,
  onSelectIndex,
  entityName,
}) => {
  if (points.length === 0) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-500">
        Insufficient historical data to build a digital twin timeline for this entity.
      </div>
    );
  }

  const safeIndex = Math.min(selectedIndex, points.length - 1);
  const currentPoint = points[safeIndex];
  // "Today" is the last observed (non-future) point; baseline is the one before it.
  const observed = points.filter((p) => !p.isFuture);
  const todayPoint = observed[observed.length - 1] || points[points.length - 1];
  const baselinePoint = observed[observed.length - 2] || observed[0] || todayPoint;

  const riskDelta30d = todayPoint.riskScore - baselinePoint.riskScore;
  const volumeDelta30d = pct(todayPoint.claimVolume, baselinePoint.claimVolume);
  const exposureDelta30d = todayPoint.estimatedExposure - baselinePoint.estimatedExposure;
  const networkDelta30d = todayPoint.networkDegree - baselinePoint.networkDegree;
  const referralDelta30d = pct(
    Math.round(todayPoint.referralDensity * 100),
    Math.round(baselinePoint.referralDensity * 100),
  );

  return (
    <div className="space-y-4">
      <div className="p-5 bg-white border border-slate-200/90 rounded-xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
              Behavioral timeline{entityName ? ` — ${entityName}` : ''}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Selected: <strong className="text-blue-700">{currentPoint.periodLabel}</strong> (
            {currentPoint.isFuture ? 'forecast model' : 'historical claims data'})
          </span>
        </div>

        <div className="relative flex items-center justify-between px-6 py-4 bg-slate-50 rounded-lg border border-slate-200/80 overflow-x-auto">
          <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 z-0" />
          <div
            className="absolute left-10 top-1/2 -translate-y-1/2 h-0.5 bg-blue-500 z-0 transition-all duration-300"
            style={{ width: `${(safeIndex / Math.max(points.length - 1, 1)) * 88}%` }}
          />
          {points.map((pt, idx) => {
            const isSelected = safeIndex === idx;
            const isToday = pt === todayPoint;
            return (
              <button key={`${pt.periodLabel}-${idx}`} onClick={() => onSelectIndex(idx)} className="relative z-10 flex flex-col items-center group focus:outline-none min-w-[64px]">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all duration-200 border-2 ${
                    isSelected ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-xs'
                    : isToday ? 'bg-rose-50 border-rose-400 text-rose-700'
                    : pt.isFuture ? 'bg-white border-blue-200 text-blue-700 hover:border-blue-400'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}
                >
                  {pt.riskScore}
                </div>
                <span className={`mt-2 text-[11px] font-medium whitespace-nowrap transition-colors ${isSelected ? 'text-blue-700 font-bold' : isToday ? 'text-rose-700 font-semibold' : 'text-slate-500 group-hover:text-slate-800'}`}>
                  {pt.periodLabel}
                </span>
                {isToday && <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold mt-0.5">Today</span>}
                {pt.isFuture && <span className="text-[9px] text-blue-600 mt-0.5">Estimate</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Selected period</span>
              <h4 className="text-sm font-bold text-slate-900">{currentPoint.periodLabel}</h4>
            </div>
            <RiskScoreGauge score={currentPoint.riskScore} size="sm" />
          </div>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
            {currentPoint.summaryNote}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200/60"><span className="text-slate-400 text-[10px] block uppercase">Claims volume</span><span className="font-semibold text-slate-900 font-mono">{currentPoint.claimVolume.toLocaleString()}</span></div>
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200/60"><span className="text-slate-400 text-[10px] block uppercase">Flagged amount</span><span className="font-semibold text-slate-900 font-mono">${currentPoint.estimatedExposure.toLocaleString()}</span></div>
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200/60"><span className="text-slate-400 text-[10px] block uppercase">Network degree</span><span className="font-semibold text-slate-900 font-mono">{currentPoint.networkDegree}</span></div>
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200/60"><span className="text-slate-400 text-[10px] block uppercase">Referral density</span><span className="font-semibold text-amber-700 font-mono">{Math.round(currentPoint.referralDensity * 100)}%</span></div>
          </div>
        </div>

        <div className="lg:col-span-2 p-4 bg-white border border-slate-200/90 rounded-xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-800">Twin delta — what changed over the last period</h4>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${riskDelta30d >= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {riskDelta30d >= 0 ? '+' : ''}{riskDelta30d} risk points
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80"><span className="text-slate-500 text-[11px]">Claim volume</span><div className="mt-2"><span className="text-xl font-bold font-mono text-rose-700">{volumeDelta30d >= 0 ? '+' : ''}{volumeDelta30d}%</span></div></div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80"><span className="text-slate-500 text-[11px]">Referral density</span><div className="mt-2"><span className="text-xl font-bold font-mono text-amber-700">{referralDelta30d >= 0 ? '+' : ''}{referralDelta30d}%</span></div></div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80"><span className="text-slate-500 text-[11px]">Network connections</span><div className="mt-2"><span className="text-xl font-bold font-mono text-blue-700">{networkDelta30d >= 0 ? '+' : ''}{networkDelta30d}</span></div></div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80"><span className="text-slate-500 text-[11px]">Flagged amount</span><div className="mt-2"><span className="text-xl font-bold font-mono text-slate-900">{exposureDelta30d >= 0 ? '+' : '-'}${Math.abs(Math.round(exposureDelta30d / 1000))}K</span></div></div>
          </div>
          <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-700">
            <span className="font-semibold text-slate-900 mr-1.5">Summary:</span>
            Risk moved from {baselinePoint.riskScore} to {todayPoint.riskScore} between {baselinePoint.periodLabel} and {todayPoint.periodLabel}, driven by the volume and relationship changes above. Deltas are computed from observed claim periods, not projected.
          </div>
        </div>
      </div>
    </div>
  );
};
