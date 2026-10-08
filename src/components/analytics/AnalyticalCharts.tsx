import React, { useId, useMemo, useState } from 'react';
import { SIU_POLICY } from '../../services/siuEligibilityService';
import { CaseRecord, EvidenceItem, ProviderRiskState } from '../../types';

const W = 760;
const H = 230;
const PAD = { top: 22, right: 22, bottom: 34, left: 42 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Monotone cubic smoothing so the line reads as a trend rather than a zig-zag. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
  const d: string[] = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const t = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}

const ChartShell: React.FC<{ title: string; subtitle: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  subtitle,
  right,
  children,
}) => (
  <section className="cs-card cs-card-hover p-5">
    <div className="flex items-start justify-between gap-3 mb-1">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">{title}</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {right}
    </div>
    {children}
  </section>
);

const EmptyChart: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-32 flex items-center justify-center text-xs text-slate-500 text-center px-6">{message}</div>
);

interface RiskTrajectoryChartProps {
  riskState?: ProviderRiskState;
  providerId?: string;
}

export const RiskTrajectoryChart: React.FC<RiskTrajectoryChartProps> = ({ riskState, providerId }) => {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const points = riskState?.riskHistory || [];

  if (points.length < 2) {
    return (
      <ChartShell title="Risk trajectory" subtitle={`${providerId || 'Provider'} · insufficient historical data`}>
        <EmptyChart message="Insufficient historical data to establish a meaningful trend." />
      </ChartShell>
    );
  }

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * PLOT_W;
  const y = (risk: number) => PAD.top + (1 - Math.max(0, Math.min(100, risk)) / 100) * PLOT_H;
  const coords = points.map((p, i) => ({ x: x(i), y: y(p.risk), risk: p.risk, raw: p }));

  const line = smoothPath(coords);
  const area = `${line} L ${coords[coords.length - 1].x} ${PAD.top + PLOT_H} L ${coords[0].x} ${PAD.top + PLOT_H} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.risk - first.risk;
  const thresholdY = y(SIU_POLICY.riskThreshold);
  const active = hover !== null ? coords[hover] : null;

  return (
    <ChartShell
      title="Risk trajectory"
      subtitle={`${providerId || riskState?.providerId || 'Provider'} · ${points.length} observed periods`}
      right={
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${delta >= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{delta} over window
        </span>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52" role="img" aria-label="Provider risk trajectory" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#2563eb" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* gridlines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#eef2f7" strokeWidth={1} />
            <text x={PAD.left - 10} y={y(v) + 3.5} textAnchor="end" className="fill-slate-300 text-[10px]">{v}</text>
          </g>
        ))}

        {/* SIU threshold band + line */}
        <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={Math.max(0, thresholdY - PAD.top)} fill="#f43f5e" opacity="0.04" />
        <line x1={PAD.left} x2={W - PAD.right} y1={thresholdY} y2={thresholdY} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.25} />
        <text x={W - PAD.right} y={thresholdY - 6} textAnchor="end" className="fill-amber-600 text-[10px] font-semibold">SIU threshold {SIU_POLICY.riskThreshold}</text>

        {/* area + line */}
        <path d={area} fill={`url(#area-${uid})`} />
        <path d={line} fill="none" stroke={`url(#line-${uid})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${uid})`} />

        {/* crosshair */}
        {active && <line x1={active.x} x2={active.x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="#93c5fd" strokeWidth={1} strokeDasharray="3 3" />}

        {/* points */}
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={hover === i ? 6 : 4} fill="#fff" stroke="#1d4ed8" strokeWidth={2.5} className="transition-all" />
            <rect
              x={c.x - PLOT_W / (coords.length * 2)}
              y={PAD.top}
              width={PLOT_W / coords.length}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}

        {/* last-value label */}
        <g>
          <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={5} fill="#1d4ed8" />
          <text x={coords[coords.length - 1].x - 6} y={coords[coords.length - 1].y - 10} textAnchor="end" className="fill-blue-700 text-[11px] font-bold font-mono">{last.risk}</text>
        </g>

        {/* axis captions */}
        <text x={PAD.left} y={H - 8} className="fill-slate-400 text-[10px]">Observed period</text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-slate-400 text-[10px]">Risk score</text>

        {/* tooltip */}
        {active && (
          <g transform={`translate(${Math.min(active.x + 10, W - 120)}, ${Math.max(active.y - 42, PAD.top)})`}>
            <rect width="112" height="36" rx="7" fill="#0f172a" opacity="0.94" />
            <text x="9" y="15" className="fill-white text-[10px] font-semibold">Risk {active.risk}</text>
            <text x="9" y="28" className="fill-slate-300 text-[9px]">
              {hover! > 0 ? `${active.risk - coords[hover! - 1].risk >= 0 ? '+' : ''}${active.risk - coords[hover! - 1].risk} vs prev` : 'first period'}
            </text>
          </g>
        )}
      </svg>
    </ChartShell>
  );
};

interface EvidenceCompositionChartProps {
  evidence: EvidenceItem[];
  onSelectType?: (type: string) => void;
  selectedType?: string;
}

export const EvidenceCompositionChart: React.FC<EvidenceCompositionChartProps> = ({ evidence, onSelectType, selectedType }) => {
  const groups = useMemo(
    () =>
      Array.from(evidence.reduce((map, item) => map.set(item.ruleName, (map.get(item.ruleName) || 0) + 1), new Map<string, number>()).entries()).sort(
        (a, b) => b[1] - a[1],
      ),
    [evidence],
  );
  const max = groups[0]?.[1] || 1;

  return (
    <ChartShell title="Evidence by detector type" subtitle={`${evidence.length} signals · ${groups.length} evidence types`}>
      {groups.length === 0 ? (
        <EmptyChart message="No evidence signals available." />
      ) : (
        <div className="space-y-2 py-1">
          {groups.map(([type, count], i) => {
            const selected = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => onSelectType?.(type)}
                className={`w-full text-left rounded-lg px-2 py-1.5 transition-colors animate-cs-rise ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-slate-700">{type.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-slate-500">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500" style={{ width: `${Math.max(8, (count / max) * 100)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ChartShell>
  );
};

export const PriorityDistributionChart: React.FC<{ cases: CaseRecord[] }> = ({ cases }) => {
  const ranked = [...cases].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 6);
  return (
    <ChartShell title="SIU priority distribution" subtitle="Eligible cases ranked by calculated priority">
      {ranked.length === 0 ? (
        <EmptyChart message="No eligible SIU cases." />
      ) : (
        <div className="space-y-2.5 py-1">
          {ranked.map((item, i) => (
            <div key={item.id} className="animate-cs-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-mono text-slate-700">{item.id} · {item.targetId}</span>
                <span className="font-mono font-semibold text-slate-800">{item.priorityScore}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-500" style={{ width: `${Math.max(4, Math.min(100, item.priorityScore))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartShell>
  );
};

interface ForecastPoint {
  label: string;
  value: number;
}

/** Observed-vs-forecast area line chart with a split marker. */
export const ForecastChart: React.FC<{ observed: ForecastPoint[]; forecast: ForecastPoint[] }> = ({ observed, forecast }) => {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const all = [...observed, ...forecast];
  if (all.length < 2) return <EmptyChart message="Insufficient data for a forecast chart." />;

  const x = (i: number) => PAD.left + (i / (all.length - 1)) * PLOT_W;
  const y = (v: number) => PAD.top + (1 - Math.max(0, Math.min(100, v)) / 100) * PLOT_H;
  const split = observed.length - 1;

  const obsCoords = observed.map((p, i) => ({ x: x(i), y: y(p.value), ...p }));
  const fcCoords = forecast.map((p, i) => ({ x: x(split + 1 + i), y: y(p.value), ...p }));
  const allCoords = [...obsCoords, ...fcCoords];

  const obsLine = smoothPath(obsCoords);
  const obsArea = `${obsLine} L ${obsCoords[obsCoords.length - 1].x} ${PAD.top + PLOT_H} L ${obsCoords[0].x} ${PAD.top + PLOT_H} Z`;
  const bridge = fcCoords.length ? smoothPath([obsCoords[obsCoords.length - 1], ...fcCoords]) : '';
  const active = hover !== null ? allCoords[hover] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" role="img" aria-label="Risk forecast" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={`fcarea-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#eef2f7" />
          <text x={PAD.left - 10} y={y(v) + 3.5} textAnchor="end" className="fill-slate-300 text-[10px]">{v}</text>
        </g>
      ))}

      {/* forecast region shading */}
      {fcCoords.length > 0 && (
        <rect x={obsCoords[obsCoords.length - 1].x} y={PAD.top} width={W - PAD.right - obsCoords[obsCoords.length - 1].x} height={PLOT_H} fill="#f43f5e" opacity="0.035" />
      )}

      <path d={obsArea} fill={`url(#fcarea-${uid})`} />
      <path d={obsLine} fill="none" stroke="#1d4ed8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {bridge && <path d={bridge} fill="none" stroke="#f43f5e" strokeWidth={2.75} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />}

      {active && <line x1={active.x} x2={active.x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="#cbd5e1" strokeDasharray="3 3" />}

      {allCoords.map((c, i) => {
        const isFc = i > split;
        return (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={hover === i ? 6 : 4} fill="#fff" stroke={isFc ? '#f43f5e' : '#1d4ed8'} strokeWidth={2.5} className="transition-all" />
            <rect x={c.x - PLOT_W / (allCoords.length * 2)} y={PAD.top} width={PLOT_W / allCoords.length} height={PLOT_H} fill="transparent" onMouseEnter={() => setHover(i)} />
            <text x={c.x} y={H - 10} textAnchor="middle" className="fill-slate-400 text-[10px]">{c.label}</text>
          </g>
        );
      })}

      {active && (
        <g transform={`translate(${Math.min(active.x + 10, W - 120)}, ${Math.max(active.y - 40, PAD.top)})`}>
          <rect width="108" height="34" rx="7" fill="#0f172a" opacity="0.94" />
          <text x="9" y="14" className="fill-white text-[10px] font-semibold">{active.label}</text>
          <text x="9" y="27" className="fill-slate-300 text-[9px]">{hover! > split ? 'forecast' : 'observed'} · {active.value}</text>
        </g>
      )}
    </svg>
  );
};
