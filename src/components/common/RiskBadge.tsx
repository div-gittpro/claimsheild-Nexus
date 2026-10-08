import React from 'react';
import { RiskLevel } from '../../types';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  showScore = true,
  className = '',
}) => {
  const getStyle = (lvl: RiskLevel) => {
    switch (lvl) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'NORMAL':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getLabel = (lvl: RiskLevel) => {
    switch (lvl) {
      case 'CRITICAL':
        return 'Critical';
      case 'HIGH':
        return 'High';
      case 'MEDIUM':
        return 'Moderate';
      case 'LOW':
        return 'Low';
      case 'NORMAL':
      default:
        return 'Normal';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStyle(
        level
      )} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          level === 'CRITICAL'
            ? 'bg-rose-500'
            : level === 'HIGH'
            ? 'bg-amber-500'
            : level === 'MEDIUM'
            ? 'bg-yellow-500'
            : level === 'LOW'
            ? 'bg-blue-500'
            : 'bg-emerald-500'
        }`}
      />
      <span>{getLabel(level)}</span>
      {showScore && score !== undefined && (
        <span className="font-semibold ml-0.5 font-mono">({score})</span>
      )}
    </span>
  );
};

export const RiskScoreGauge: React.FC<{ score: number; max?: number; size?: 'sm' | 'md' | 'lg' }> = ({
  score,
  max = 100,
  size = 'md',
}) => {
  const getColor = (s: number) => {
    if (s >= 85) return 'text-rose-600 stroke-rose-500';
    if (s >= 70) return 'text-amber-600 stroke-amber-500';
    if (s >= 45) return 'text-yellow-600 stroke-yellow-500';
    if (s >= 25) return 'text-blue-600 stroke-blue-500';
    return 'text-emerald-600 stroke-emerald-500';
  };

  const percentage = Math.min(100, Math.max(0, (score / max) * 100));
  const strokeWidth = size === 'lg' ? 6 : size === 'md' ? 5 : 3.5;
  const radius = size === 'lg' ? 36 : size === 'md' ? 26 : 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const dimension = (radius + strokeWidth) * 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={dimension}
        height={dimension}
        className="transform -rotate-90"
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
          fill="transparent"
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${getColor(score)} transition-all duration-500 ease-out`}
          fill="transparent"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span
          className={`font-semibold font-mono leading-none ${
            size === 'lg' ? 'text-xl' : size === 'md' ? 'text-sm' : 'text-xs'
          } ${getColor(score).split(' ')[0]}`}
        >
          {score}
        </span>
        {size === 'lg' && (
          <span className="text-[10px] text-slate-400 font-medium mt-0.5">
            /100
          </span>
        )}
      </div>
    </div>
  );
};
