import React, { useMemo, useRef, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { UploadCloud, Database, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

const Stage: React.FC<{ index: number; label: string; done: boolean }> = ({ index, label, done }) => (
  <div className="flex items-center gap-2">
    <span
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
        done ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500 border border-slate-200'
      }`}
    >
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : index}
    </span>
    <span className={`text-[11px] font-medium ${done ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
  </div>
);

const QualityStat: React.FC<{ label: string; value: number | string; tone?: string }> = ({ label, value, tone = 'text-slate-900' }) => (
  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
    <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">{label}</span>
    <span className={`text-lg font-bold font-mono ${tone}`}>{value}</span>
  </div>
);

export const IngestionView: React.FC = () => {
  const {
    claims,
    providers,
    members,
    facilities,
    networks,
    uploadClaimsCSV,
    reprocessDataset,
    activeDatasetName,
    integrityErrors,
    currentRun,
    rejectedRows,
    evidenceRecords,
  } = useNexus();

  const [uploadMode, setUploadMode] = useState<'FILE' | 'PASTE'>('FILE');
  const [pastedCSV, setPastedCSV] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasData = claims.length > 0;

  const quality = useMemo(() => {
    const missingProvider = claims.filter((c) => !c.providerId).length;
    const invalidDates = claims.filter((c) => !c.serviceDate || Number.isNaN(Date.parse(c.serviceDate))).length;
    const seen = new Set<string>();
    let duplicates = 0;
    claims.forEach((c) => {
      const key = `${c.providerId}|${c.memberId}|${c.procedureCode}|${c.serviceDate}`;
      if (seen.has(key)) duplicates += 1;
      else seen.add(key);
    });
    const valid = claims.length - missingProvider - invalidDates;
    return { total: claims.length, valid, missingProvider, invalidDates, duplicates };
  }, [claims]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setUploadStatus(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = uploadClaimsCSV(event.target?.result as string, file.name);
      setUploadStatus(res);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setUploadStatus({ success: false, message: 'Failed to read file.' });
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleProcessPasted = () => {
    if (!pastedCSV.trim()) return;
    setIsProcessing(true);
    const res = uploadClaimsCSV(pastedCSV, 'Pasted_Dataset.csv');
    setUploadStatus(res);
    setIsProcessing(false);
  };

  const entityCounts = [
    { label: 'Claims', value: claims.length },
    { label: 'Providers', value: providers.length },
    { label: 'Members', value: members.length },
    { label: 'Facilities', value: facilities.length },
    { label: 'Networks', value: networks.length },
    { label: 'Evidence records', value: evidenceRecords.length },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Data Ingestion</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Upload claims, resolve entities, validate quality, then run the analytical pipeline.
        </p>
      </div>

      {/* Ingestion pipeline stages (Section 33) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 p-3.5 bg-white border border-slate-200 rounded-xl">
        <Stage index={1} label="Upload CSV" done={hasData} />
        <span className="text-slate-300">→</span>
        <Stage index={2} label="Schema detection" done={hasData} />
        <span className="text-slate-300">→</span>
        <Stage index={3} label="Validation" done={hasData} />
        <span className="text-slate-300">→</span>
        <Stage index={4} label="Entity resolution" done={hasData} />
        <span className="text-slate-300">→</span>
        <Stage index={5} label="Data quality" done={hasData} />
        <span className="text-slate-300">→</span>
        <Stage index={6} label="Preview" done={hasData} />
        <span className="text-slate-300">→</span>
        <Stage index={7} label="Run analysis" done={hasData && currentRun?.status === 'COMPLETED'} />
      </div>

      {/* Active dataset */}
      {hasData && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">Active dataset:</span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-xs font-semibold">{activeDatasetName}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {claims.length} claims analyzed{currentRun && <span className="ml-2 font-mono">{currentRun.runId} · {currentRun.status}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => setUploadStatus(reprocessDataset())}
            disabled={!currentRun}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-medium border border-slate-200"
          >
            Reprocess Dataset
          </button>
        </div>
      )}

      {/* Upload box */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Ingest healthcare claims (CSV)</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Re-runs detectors, graph construction, risk scoring and SIU eligibility.</p>
          </div>
          <div className="flex items-center p-1 rounded-lg bg-slate-100 text-xs">
            {(['FILE', 'PASTE'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setUploadMode(m)}
                className={`px-3 py-1 rounded font-medium transition-all ${uploadMode === m ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500'}`}
              >
                {m === 'FILE' ? 'Upload File' : 'Paste CSV'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {uploadMode === 'FILE' ? (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-4 hover:border-blue-500 transition-colors bg-slate-50/50">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Select or drop your claims CSV</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Columns: <code>claim_id, provider_id, member_id, facility_id, procedure_code, billed_amount, service_date</code>.
                </p>
              </div>
              <input type="file" ref={fileInputRef} accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                Browse Files
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                rows={8}
                value={pastedCSV}
                onChange={(e) => setPastedCSV(e.target.value)}
                placeholder="claim_id,provider_id,member_id,procedure_code,billed_amount,service_date..."
                className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleProcessPasted}
                  disabled={isProcessing || !pastedCSV.trim()}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Parse & Ingest Claims'}
                </button>
              </div>
            </div>
          )}

          {uploadStatus && (
            <div className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${uploadStatus.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
              {uploadStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{uploadStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {hasData && (
        <>
          {/* Data quality (Section 34) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Data quality — {quality.total} claims</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <QualityStat label="Valid" value={quality.valid} tone="text-emerald-700" />
              <QualityStat label="Missing provider" value={quality.missingProvider} tone={quality.missingProvider ? 'text-amber-700' : 'text-slate-900'} />
              <QualityStat label="Duplicate claims" value={quality.duplicates} tone={quality.duplicates ? 'text-amber-700' : 'text-slate-900'} />
              <QualityStat label="Invalid dates" value={quality.invalidDates} tone={quality.invalidDates ? 'text-amber-700' : 'text-slate-900'} />
              <QualityStat label="Rejected rows" value={rejectedRows} tone={rejectedRows ? 'text-rose-700' : 'text-slate-900'} />
            </div>
            <p className="text-[11px] text-slate-400">
              Flagged rows are retained and surfaced for review — records are never silently discarded.
            </p>
            {integrityErrors.length > 0 && (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-[11px]">
                <strong>Data integrity errors:</strong> {integrityErrors.join(' ')}
              </div>
            )}
          </div>

          {/* Resolved entities */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Resolved entities</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {entityCounts.map((e) => (
                <QualityStat key={e.label} label={e.label} value={e.value} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Dataset preview
              </span>
              <span className="text-slate-400 text-xs">First 6 of {claims.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Claim</th>
                    <th className="py-2.5 px-4">Provider</th>
                    <th className="py-2.5 px-4">Procedure</th>
                    <th className="py-2.5 px-4 text-right">Billed</th>
                    <th className="py-2.5 px-4">Service date</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {claims.slice(0, 6).map((clm) => (
                    <tr key={clm.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{clm.id}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-800">{clm.providerName} ({clm.providerId})</td>
                      <td className="py-2.5 px-4 text-blue-700">CPT {clm.procedureCode}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">${clm.billedAmount.toLocaleString()}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-500">{clm.serviceDate}</td>
                      <td className="py-2.5 px-4 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${clm.status === 'FLAGGED' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{clm.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
