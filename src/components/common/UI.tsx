import React from 'react';

/* Shared enterprise UI primitives for a consistent visual language across pages. */

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }> = ({
  hover,
  className = '',
  children,
  ...rest
}) => (
  <div className={`cs-card ${hover ? 'cs-card-hover' : ''} ${className}`} {...rest}>
    {children}
  </div>
);

export const PageHeader: React.FC<{
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ icon, title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 mb-6 border-b border-slate-200/80">
    <div className="flex items-start gap-3">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
          {icon}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const SectionTitle: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }> = ({
  icon,
  children,
  right,
}) => (
  <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
    <div className="flex items-center gap-2">
      {icon && <span className="text-blue-600">{icon}</span>}
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">{children}</h2>
    </div>
    {right}
  </div>
);

type Tone = 'default' | 'rose' | 'amber' | 'emerald' | 'purple' | 'blue';

const toneAccent: Record<Tone, string> = {
  default: 'from-slate-400/70 to-slate-300/40',
  rose: 'from-rose-500 to-rose-400',
  amber: 'from-amber-500 to-amber-400',
  emerald: 'from-emerald-500 to-emerald-400',
  purple: 'from-purple-500 to-purple-400',
  blue: 'from-blue-600 to-blue-400',
};

const toneValue: Record<Tone, string> = {
  default: 'text-slate-900',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  purple: 'text-purple-700',
  blue: 'text-blue-700',
};

const toneIconBg: Record<Tone, string> = {
  default: 'bg-slate-100 text-slate-500',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-purple-50 text-purple-600',
  blue: 'bg-blue-50 text-blue-600',
};

/** Metric card with a tone accent bar, optional icon and secondary text. */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  mono?: boolean;
}> = ({ label, value, sub, tone = 'default', icon, mono = true }) => (
  <Card hover className="relative overflow-hidden p-4">
    <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${toneAccent[tone]}`} />
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <span className="cs-section-label block truncate">{label}</span>
        <div className={`text-2xl font-bold tracking-tight mt-1 ${mono ? 'font-mono' : ''} ${toneValue[tone]}`}>
          {value}
        </div>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
      </div>
      {icon && (
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneIconBg[tone]}`}>
          {icon}
        </span>
      )}
    </div>
  </Card>
);

/** Compact inline stat used inside dense panels. */
export const MiniStat: React.FC<{ label: string; value: React.ReactNode; sub?: string; tone?: Tone }> = ({
  label,
  value,
  sub,
  tone = 'default',
}) => (
  <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
    <span className="cs-section-label block">{label}</span>
    <span className={`text-lg font-bold font-mono ${toneValue[tone]}`}>{value}</span>
    {sub && <span className="text-[10px] text-slate-400 block">{sub}</span>}
  </div>
);

export const Pill: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'blue',
  children,
  className = '',
}) => {
  const styles: Record<Tone, string> = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${styles[tone]} ${className}`}>
      {children}
    </span>
  );
};

/** Thin progress bar with tone gradient. */
export const Bar: React.FC<{ value: number; max?: number; tone?: Tone; className?: string }> = ({
  value,
  max = 100,
  tone = 'blue',
  className = '',
}) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const grad: Record<Tone, string> = {
    default: 'from-slate-400 to-slate-300',
    rose: 'from-rose-500 to-rose-400',
    amber: 'from-amber-500 to-amber-400',
    emerald: 'from-emerald-500 to-emerald-400',
    purple: 'from-purple-500 to-purple-400',
    blue: 'from-blue-600 to-blue-400',
  };
  return (
    <div className={`h-1.5 rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${grad[tone]} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export function riskTone(score: number): Tone {
  if (score >= 85) return 'rose';
  if (score >= 70) return 'amber';
  if (score >= 45) return 'blue';
  return 'emerald';
}
