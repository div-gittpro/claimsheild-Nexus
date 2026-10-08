import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    text: string;
    isWarning?: boolean;
  };
  icon?: LucideIcon;
  variant?: 'default' | 'danger' | 'warning' | 'info';
  badge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  trend,
  icon: Icon,
  variant = 'default',
  badge,
}) => {
  const getIconStyle = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'warning':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'info':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-500">
          {label}
        </span>
        {badge && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {badge}
          </span>
        )}
        {Icon && !badge && (
          <div className={`p-1.5 rounded-lg border ${getIconStyle()}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-900 font-mono">
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-slate-500">{subValue}</span>
        )}
      </div>

      {trend && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
          <span
            className={`font-medium ${
              trend.isWarning
                ? 'text-rose-600'
                : trend.direction === 'up'
                ? 'text-slate-600'
                : trend.direction === 'down'
                ? 'text-emerald-600'
                : 'text-slate-500'
            }`}
          >
            {trend.text}
          </span>
        </div>
      )}
    </div>
  );
};
