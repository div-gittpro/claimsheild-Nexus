import React, { useMemo } from 'react';
import { useNexus } from '../store/useNexusStore';
import { NetworkGraph } from '../components/network/NetworkGraph';
import { GraphNode } from '../types';
import { StatCard, riskTone } from '../components/common/UI';
import { Share2, Users, Building2, GitBranch, Info } from 'lucide-react';

/** Deterministic radial layout: providers on an inner ring, other entities on an outer ring. */
function layoutNodes(nodes: GraphNode[]): GraphNode[] {
  const providers = nodes.filter((n) => n.type === 'PROVIDER');
  const others = nodes.filter((n) => n.type !== 'PROVIDER');
  const cx = 380;
  const cy = 230;
  const place = (list: GraphNode[], radius: number) =>
    list.map((n, i) => {
      const angle = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return { ...n, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });
  return [...place(providers, providers.length > 1 ? 130 : 0), ...place(others, 240)];
}

const SummaryStat: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'rose' | 'amber' | 'emerald' | 'purple' | 'blue' }> = ({ label, value, tone = 'default' }) => (
  <StatCard label={label} value={value} tone={tone} />
);

export const NetworkIntelligenceView: React.FC = () => {
  const { networks, currentNetwork, setSelectedNetworkId, graphData, setSelectedProviderId, setActiveTab } = useNexus();

  const positioned = useMemo(() => layoutNodes(graphData.nodes), [graphData.nodes]);

  if (networks.length === 0) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-200">
          <Share2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Network Intelligence</h1>
        </div>
        <div className="mt-8 p-8 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-500">
          No connected provider clusters were detected in the current dataset. Networks form when providers share both
          members and facilities.
        </div>
      </div>
    );
  }

  const net = currentNetwork!;
  const providerCount = graphData.nodes.filter((n) => n.type === 'PROVIDER').length;
  const facilityCount = graphData.nodes.filter((n) => n.type === 'FACILITY').length;
  const referralLinks = graphData.edges.filter((e) => e.type === 'REFERS').length;

  return (
    <div className="p-8 max-w-[90rem] mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Network Intelligence</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Emerging networks and connected provider clusters. Relationship concentration is a review signal, not proof.
          </p>
        </div>
        {networks.length > 1 && (
          <select
            value={net.id}
            onChange={(e) => setSelectedNetworkId(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
          >
            {networks.map((n) => (
              <option key={n.id} value={n.id}>{n.id} — risk {n.riskScore}</option>
            ))}
          </select>
        )}
      </div>

      {/* Network summary (Section 15) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryStat label="Network risk" value={net.riskScore} tone={riskTone(net.riskScore)} />
        <SummaryStat label="Network size" value={net.providerCount + net.facilityCount} tone="blue" />
        <SummaryStat label="Connected providers" value={providerCount} />
        <SummaryStat label="Shared members" value={net.memberCount} tone="emerald" />
        <SummaryStat label="Facilities" value={facilityCount} tone="amber" />
        <SummaryStat label="Referral links" value={referralLinks} tone="purple" />
      </div>

      {/* Graph + why this matters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-[520px]">
          <NetworkGraph
            nodes={positioned}
            edges={graphData.edges}
            networkTitle={`${net.id} · ${net.name}`}
            selectedNodeId={positioned[0]?.id}
            onSelectNode={(id) => {
              if (graphData.nodes.find((n) => n.id === id && n.type === 'PROVIDER')) {
                setSelectedProviderId(id);
                setActiveTab('PROVIDERS');
              }
            }}
          />
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Why this network matters</h2>
            <div className="space-y-2">
              {net.suspiciousSignals.length > 0 ? (
                net.suspiciousSignals.map((s) => (
                  <div key={s} className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <span className="text-slate-700">{s.replace(/_/g, ' ')}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No independent evidence signals observed within this cluster yet.</p>
              )}
            </div>
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
              <div className="flex justify-between"><span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-600" /> Members</span><span className="font-mono">{net.memberCount}</span></div>
              <div className="flex justify-between"><span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-amber-600" /> Facilities</span><span className="font-mono">{net.facilityCount}</span></div>
              <div className="flex justify-between"><span className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5 text-purple-600" /> Trajectory</span><span className="font-mono">{net.trajectory}</span></div>
              <div className="flex justify-between"><span>Estimated exposure</span><span className="font-mono font-semibold text-slate-900">${net.estimatedExposure.toLocaleString()}</span></div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              This is an <strong>emerging network</strong> — a connected provider cluster with observed relationship
              concentration. Network exposure warrants review; it does not establish wrongdoing.
            </span>
          </div>
        </div>
      </div>

      {/* Member/facility relationship labels (Section 14) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">Observed relationships</h2>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {['Shared member', 'Referral', 'Shared facility', 'Shared location', 'Ownership indicator', 'Claim relationship'].map((label) => (
            <span key={label} className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
};
