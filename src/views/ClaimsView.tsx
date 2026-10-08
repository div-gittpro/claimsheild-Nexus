import React, { useMemo, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { FileSpreadsheet, Search, ArrowUpDown } from 'lucide-react';

export const ClaimsView: React.FC = () => {
  const { claims, cases, openCase } = useNexus();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FLAGGED' | 'PAID'>('ALL');
  const [sortBy, setSortBy] = useState<'risk' | 'amount' | 'date'>('risk');
  const [expanded, setExpanded] = useState<string | null>(null);

  const caseByProvider = useMemo(() => {
    const map = new Map<string, string>();
    cases.forEach((c) => c.providerId && map.set(c.providerId, c.id));
    return map;
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return claims
      .filter((c) => {
        if (statusFilter === 'FLAGGED' && c.status !== 'FLAGGED') return false;
        if (statusFilter === 'PAID' && c.status === 'FLAGGED') return false;
        return (
          q === '' ||
          c.id.toLowerCase().includes(q) ||
          c.providerName.toLowerCase().includes(q) ||
          c.providerId.toLowerCase().includes(q) ||
          c.procedureCode.toLowerCase().includes(q) ||
          c.memberId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'amount') return b.billedAmount - a.billedAmount;
        if (sortBy === 'date') return Date.parse(b.serviceDate) - Date.parse(a.serviceDate);
        return b.riskScore - a.riskScore;
      });
  }, [claims, search, statusFilter, sortBy]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Claims</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">All claims in the active dataset with detector signals and risk contribution.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search claim, provider, member, or CPT code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none">
            <option value="ALL">All statuses</option>
            <option value="FLAGGED">Flagged only</option>
            <option value="PAID">Unflagged</option>
          </select>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none">
              <option value="risk">Risk contribution</option>
              <option value="amount">Billed amount</option>
              <option value="date">Service date</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">Showing <strong>{filtered.length}</strong> of {claims.length} claims</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
              <tr>
                <th className="py-3 px-4">Claim ID</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Procedure</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Facility</th>
                <th className="py-3 px-4">Detector signals</th>
                <th className="py-3 px-4 text-center">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 200).map((clm) => {
                const relatedCase = caseByProvider.get(clm.providerId);
                const isOpen = expanded === clm.id;
                return (
                  <React.Fragment key={clm.id}>
                    <tr onClick={() => setExpanded(isOpen ? null : clm.id)} className="hover:bg-slate-50/80 cursor-pointer transition-colors">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{clm.id}</td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono">{clm.serviceDate}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">{clm.memberId}</td>
                      <td className="py-2.5 px-4"><span className="font-mono text-blue-700">CPT {clm.procedureCode}</span></td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">${clm.billedAmount.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono">{clm.facilityId}</td>
                      <td className="py-2.5 px-4">
                        {clm.flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {clm.flags.slice(0, 2).map((f) => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">{f.replace(/_/g, ' ')}</span>
                            ))}
                            {clm.flags.length > 2 && <span className="text-[10px] text-slate-400">+{clm.flags.length - 2}</span>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${clm.riskScore >= 70 ? 'bg-rose-50 text-rose-700' : clm.riskScore >= 40 ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{clm.riskScore}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                            <div><span className="text-slate-400 block">Provider</span><span className="font-medium text-slate-800">{clm.providerName} ({clm.providerId})</span></div>
                            <div><span className="text-slate-400 block">Procedure</span><span className="font-medium text-slate-800">{clm.procedureDescription || clm.procedureCode}</span></div>
                            <div><span className="text-slate-400 block">Diagnosis</span><span className="font-mono text-slate-800">{clm.diagnosisCode || '—'}</span></div>
                            <div><span className="text-slate-400 block">Allowed / Paid</span><span className="font-mono text-slate-800">${clm.allowedAmount.toLocaleString()} / ${clm.paidAmount.toLocaleString()}</span></div>
                          </div>
                          {clm.ruleViolations.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {clm.ruleViolations.map((rv, i) => (
                                <div key={i} className="text-[11px] text-slate-600"><span className="font-mono text-rose-700 font-semibold">{rv.ruleName}</span> — {rv.evidence}</div>
                              ))}
                            </div>
                          )}
                          {relatedCase && (
                            <button onClick={(e) => { e.stopPropagation(); openCase(relatedCase); }} className="mt-2 text-[11px] text-blue-600 hover:text-blue-800 font-semibold">
                              Open related case {relatedCase} →
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && <div className="px-5 py-2 text-[11px] text-slate-400 border-t border-slate-100">Showing first 200 — refine your search to narrow results.</div>}
      </div>
    </div>
  );
};
