import React, { useMemo, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { verifyAuditChain, verifyAllSignatures } from '../services/auditLedgerService';
import { shortHash } from '../services/hashUtil';
import { PageHeader, StatCard } from '../components/common/UI';
import { ScrollText, ShieldCheck, CheckCircle2, XCircle, Fingerprint } from 'lucide-react';

const KpiCard: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value }) => (
  <StatCard label={label} value={value} tone="blue" />
);

export const AuditLedgerView: React.FC = () => {
  const { auditChain, activePolicy } = useNexus();

  const [chainResult, setChainResult] = useState<ReturnType<typeof verifyAuditChain> | null>(null);
  const [sigResult, setSigResult] = useState<ReturnType<typeof verifyAllSignatures> | null>(null);

  const humanDecisions = useMemo(
    () => auditChain.filter((b) => b.eventType === 'HUMAN_FEEDBACK_RECORDED').length,
    [auditChain],
  );

  // Newest-first for display.
  const display = useMemo(() => [...auditChain].reverse(), [auditChain]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      <PageHeader
        icon={<ScrollText className="w-5 h-5" />}
        title="Audit Ledger"
        subtitle="Append-only hash chain — Hash(n) = SHA-256(eventData + Hash(n-1)) — plus a reproducible signature on every block."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Blocks" value={auditChain.length} mono />
        <KpiCard label="Human decisions" value={humanDecisions} mono />
        <KpiCard label="Policy hash" value={shortHash(activePolicy.hash, 8)} mono />
        <KpiCard label="Chain head" value={auditChain.length ? shortHash(auditChain[auditChain.length - 1].hash, 8) : '—'} mono />
      </div>

      {/* Verification controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setChainResult(verifyAuditChain(auditChain))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Verify Chain
        </button>
        <button
          onClick={() => setSigResult(verifyAllSignatures(auditChain))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
        >
          <Fingerprint className="w-3.5 h-3.5 text-blue-600" /> Verify Signatures
        </button>

        {chainResult && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${chainResult.valid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {chainResult.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {chainResult.valid ? `Chain intact — ${chainResult.checkedBlocks} blocks verified` : `Chain broken at block ${chainResult.brokenAtIndex}`}
          </span>
        )}
        {sigResult && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${sigResult.valid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            {sigResult.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {sigResult.verifiedCount}/{sigResult.total} signatures verified
          </span>
        )}
      </div>

      {/* Ledger blocks */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-800">
          Latest blocks (newest first)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Event type</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Prev hash</th>
                <th className="py-3 px-4">Hash</th>
                <th className="py-3 px-4">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {display.slice(0, 50).map((b) => (
                <tr key={b.eventId} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 text-slate-400">{b.index}</td>
                  <td className="py-2.5 px-4 text-slate-500">{new Date(b.timestamp).toLocaleTimeString()}</td>
                  <td className="py-2.5 px-4 font-sans text-slate-800">{b.actor}</td>
                  <td className="py-2.5 px-4"><span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-sans font-medium text-[10px]">{b.eventType}</span></td>
                  <td className="py-2.5 px-4 text-slate-700">{b.entityId}</td>
                  <td className="py-2.5 px-4 text-slate-400">{shortHash(b.previousHash, 8)}</td>
                  <td className="py-2.5 px-4 text-slate-900 font-semibold">{shortHash(b.hash, 8)}</td>
                  <td className="py-2.5 px-4 text-emerald-700">{shortHash(b.signature, 8)}</td>
                </tr>
              ))}
              {display.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-slate-500 font-sans text-xs">No audit events recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
