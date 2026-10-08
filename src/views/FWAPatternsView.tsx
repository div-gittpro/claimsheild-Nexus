import React, { useMemo, useState } from 'react';
import { useNexus } from '../store/useNexusStore';
import { Fingerprint, ChevronDown, Cpu } from 'lucide-react';

interface DetectorSpec {
  type: string;
  name: string;
  description: string;
  detectionLogic: string;
  requiredFields: string[];
  severity: 'HIGH' | 'MEDIUM' | 'CRITICAL';
  model: string;
  features: string[];
}

// Specifications mirror the detectors implemented in claimsAnalysisService.ts.
const DETECTOR_SPECS: DetectorSpec[] = [
  {
    type: 'DUPLICATE_BILLING',
    name: 'Duplicate Billing',
    description: 'Identical procedure billed multiple times for the same member, provider and date.',
    detectionLogic: 'Group claims by provider + member + procedure code + service date; flag groups with 2+ members.',
    requiredFields: ['provider_id', 'member_id', 'procedure_code', 'service_date'],
    severity: 'HIGH',
    model: 'Deterministic grouping rule',
    features: ['Procedure code', 'Service date', 'Provider-member pair'],
  },
  {
    type: 'UPCODING_PATTERN',
    name: 'Upcoding',
    description: 'Disproportionate use of high-complexity evaluation & management codes versus peer distribution.',
    detectionLogic: 'Compare share of Level 4/5 E&M codes (99214/99215) against the provider\'s own E&M volume; flag when high-complexity ratio exceeds 50% with 3+ claims.',
    requiredFields: ['provider_id', 'procedure_code'],
    severity: 'MEDIUM',
    model: 'Peer-normalized distribution test',
    features: ['Procedure complexity mix', 'E&M volume', 'High-complexity ratio'],
  },
  {
    type: 'UNBUNDLING_PATTERN',
    name: 'Unbundling',
    description: 'Component procedures billed separately when a bundled code is expected.',
    detectionLogic: 'Detect multiple distinct bundle-component codes for the same provider + member + date.',
    requiredFields: ['provider_id', 'member_id', 'procedure_code', 'service_date'],
    severity: 'HIGH',
    model: 'Procedure-combination rule',
    features: ['Procedure code set', 'Same-day grouping'],
  },
  {
    type: 'EXCESSIVE_UTILIZATION',
    name: 'Excessive Utilization',
    description: 'A member receives an abnormally high number of services from a single provider.',
    detectionLogic: 'Count services per member-provider pair; flag when 5+ services are observed.',
    requiredFields: ['provider_id', 'member_id'],
    severity: 'MEDIUM',
    model: 'Utilization threshold rule',
    features: ['Service count per member', 'Provider concentration'],
  },
  {
    type: 'IMPOSSIBLE_TIMING',
    name: 'Impossible Timing',
    description: 'Services at distant locations within a physically infeasible travel window.',
    detectionLogic: 'For sequential claims, compare geographic distance against elapsed time; flag when estimated travel exceeds available minutes.',
    requiredFields: ['service_timestamp', 'latitude', 'longitude'],
    severity: 'CRITICAL',
    model: 'Temporal-feasibility (haversine) rule',
    features: ['Geo distance', 'Timestamp delta', 'Estimated travel time'],
  },
];

const sevClass: Record<string, string> = {
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  HIGH: 'bg-amber-50 text-amber-800 border-amber-200',
  MEDIUM: 'bg-yellow-50 text-yellow-800 border-yellow-200',
};

export const FWAPatternsView: React.FC = () => {
  const { evidenceRecords } = useNexus();
  const [open, setOpen] = useState<string | null>(DETECTOR_SPECS[0].type);

  // Derive live stats per detector from canonical evidence records.
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; avgConfidence: number; lastEvaluated: string }>();
    DETECTOR_SPECS.forEach((d) => map.set(d.type, { count: 0, avgConfidence: 0, lastEvaluated: '' }));
    evidenceRecords.forEach((e) => {
      const cur = map.get(e.type);
      if (!cur) return;
      const nextCount = cur.count + 1;
      cur.avgConfidence = (cur.avgConfidence * cur.count + e.confidence) / nextCount;
      cur.count = nextCount;
      if (!cur.lastEvaluated || e.createdAt > cur.lastEvaluated) cur.lastEvaluated = e.createdAt;
    });
    return map;
  }, [evidenceRecords]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">FWA Pattern Library</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Supported fraud, waste & abuse detectors, their detection logic, required fields and the evidence they generate.
        </p>
      </div>

      <div className="space-y-3">
        {DETECTOR_SPECS.map((d) => {
          const s = stats.get(d.type)!;
          const isOpen = open === d.type;
          return (
            <div key={d.type} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : d.type)}
                className="w-full p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{d.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sevClass[d.severity]}`}>{d.severity}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{d.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Evidence generated</span>
                    <span className="font-mono font-bold text-slate-900">{s.count}</span>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-slate-400 uppercase block">Avg confidence</span>
                    <span className="font-mono font-semibold text-slate-700">{s.count ? `${Math.round(s.avgConfidence)}%` : '—'}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isOpen && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Detection logic</span>
                    <p className="text-slate-700 leading-relaxed">{d.detectionLogic}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Required fields</span>
                      <div className="flex flex-wrap gap-1">
                        {d.requiredFields.map((f) => (
                          <span key={f} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">Model features</span>
                      <div className="flex flex-wrap gap-1">
                        {d.features.map((f) => (
                          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Model transparency (Section 38) */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-500"><Cpu className="w-3.5 h-3.5 text-blue-600" /> Model: <strong className="text-slate-800">{d.model}</strong></span>
                    <span className="text-slate-500">Triggers: <strong className="font-mono text-slate-800">{s.count}</strong></span>
                    <span className="text-slate-500">Last evaluated: <strong className="font-mono text-slate-800">{s.lastEvaluated ? new Date(s.lastEvaluated).toLocaleString() : 'Not run'}</strong></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400">
        Detector output is statistical evidence of anomalous billing. It flags claims for human review and does not
        constitute a determination of fraud.
      </p>
    </div>
  );
};
