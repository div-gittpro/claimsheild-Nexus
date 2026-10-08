import React from 'react';
import { CaseStatus } from '../../types';

export const StatusBadge: React.FC<{ status: CaseStatus | string; className?: string }> = ({
  status,
  className = '',
}) => {
  const getStyle = (st: string) => {
    switch (st) {
      case 'NEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'UNDER_REVIEW':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'EVIDENCE_REQUESTED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'FIELD_INTERVIEW':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'RESOLVED_FWA':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
      case 'CLOSED_NOT_FWA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FALSE_POSITIVE':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'FLAGGED':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-medium';
      case 'PAID':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DENIED':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatText = (st: string) => {
    switch (st) {
      case 'NEW':
        return 'New Case';
      case 'UNDER_REVIEW':
        return 'Under Review';
      case 'EVIDENCE_REQUESTED':
        return 'Evidence Requested';
      case 'FIELD_INTERVIEW':
        return 'Interview Planned';
      case 'RESOLVED_FWA':
        return 'Confirmed Issue';
      case 'CLOSED_NOT_FWA':
        return 'Cleared (Normal)';
      case 'FALSE_POSITIVE':
        return 'False Alarm';
      case 'FLAGGED':
        return 'Needs Review';
      case 'PAID':
        return 'Paid';
      case 'DENIED':
        return 'Denied';
      default:
        return st.replace(/_/g, ' ');
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStyle(
        status
      )} ${className}`}
    >
      {formatText(status)}
    </span>
  );
};
