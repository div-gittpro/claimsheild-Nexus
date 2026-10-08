import React, { useState, useEffect } from 'react';
import { useNexus } from '../../store/useNexusStore';
import { RiskBadge } from '../common/RiskBadge';
import {
  Search,
  X,
  Stethoscope,
  Network,
  FolderOpen,
  Building2,
  User,
  ArrowRight,
} from 'lucide-react';

export const GlobalSearchModal: React.FC = () => {
  const {
    searchOpen,
    setSearchOpen,
    providers,
    claims,
    facilities,
    members,
    networks,
    cases,
    openCase,
    setSelectedProviderId,
    setSelectedNetworkId,
    setActiveTab,
    setEntitiesSubTab,
  } = useNexus();

  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  if (!searchOpen) return null;

  const q = query.toLowerCase().trim();

  const matchedCases = q
    ? cases.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.targetName.toLowerCase().includes(q) ||
          c.targetId.toLowerCase().includes(q)
      )
    : cases.slice(0, 3);

  const matchedProviders = q
    ? providers.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.specialty.toLowerCase().includes(q)
      )
    : providers.slice(0, 3);

  const matchedNetworks = q
    ? networks.filter(
        (n) => n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)
      )
    : networks.slice(0, 2);

  const matchedMembers = q
    ? members.filter(
        (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      )
    : members.slice(0, 2);

  const matchedFacilities = q
    ? facilities.filter(
        (f) =>
          f.id.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.location.toLowerCase().includes(q)
      )
    : facilities.slice(0, 2);

  const handleSelectCase = (id: string) => {
    openCase(id);
    setSearchOpen(false);
  };

  const handleSelectProvider = (id: string) => {
    setSelectedProviderId(id);
    const relatedCase = cases.find((c) => c.targetId === id);
    if (relatedCase) {
      openCase(relatedCase.id);
    } else {
      setActiveTab('ENTITIES');
      setEntitiesSubTab('PROVIDERS');
    }
    setSearchOpen(false);
  };

  const handleSelectNetwork = (id: string) => {
    setSelectedNetworkId(id);
    setActiveTab('ENTITIES');
    setEntitiesSubTab('NETWORKS');
    setSearchOpen(false);
  };

  const handleSelectMember = () => {
    setActiveTab('ENTITIES');
    setEntitiesSubTab('MEMBERS');
    setSearchOpen(false);
  };

  const handleSelectFacility = () => {
    setActiveTab('ENTITIES');
    setEntitiesSubTab('FACILITIES');
    setSearchOpen(false);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (matchedCases.length > 0) {
        handleSelectCase(matchedCases[0].id);
      } else if (matchedProviders.length > 0) {
        handleSelectProvider(matchedProviders[0].id);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            type="text"
            placeholder="Search claims, providers (e.g. P1029, Vance), members, cases..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownInput}
            autoFocus
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-3.5 text-xs">
          {/* Cases */}
          {matchedCases.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Priority Cases
              </span>
              <div className="space-y-1">
                {matchedCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c.id)}
                    className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50 cursor-pointer border border-slate-200/80 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 font-mono">{c.id}</span>
                          <span className="text-slate-500 font-mono text-[11px]">{c.targetId}</span>
                        </div>
                        <span className="text-slate-600 truncate block text-[11px]">{c.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={c.riskLevel} score={c.riskScore} />
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Providers */}
          {matchedProviders.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Healthcare Providers
              </span>
              <div className="space-y-1">
                {matchedProviders.map((p) => {
                  const relatedCases = cases.filter((c) => c.targetId === p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProvider(p.id)}
                      className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50 cursor-pointer border border-slate-200/80 flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{p.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {p.id}
                            </span>
                          </div>
                          <span className="text-slate-500 text-[11px]">
                            {p.specialty} • {relatedCases.length} Active Cases
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <RiskBadge level={p.riskLevel} score={p.riskScore} />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Networks */}
          {matchedNetworks.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Provider Networks
              </span>
              <div className="space-y-1">
                {matchedNetworks.map((net) => (
                  <div
                    key={net.id}
                    onClick={() => handleSelectNetwork(net.id)}
                    className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50 cursor-pointer border border-slate-200/80 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Network className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 font-mono">{net.id}</span>
                          <span className="text-slate-700">{net.name}</span>
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          {net.providerCount} Providers • {net.facilityCount} Facilities
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={net.riskScore >= 80 ? 'CRITICAL' : 'HIGH'} score={net.riskScore} />
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {matchedMembers.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Members
              </span>
              <div className="space-y-1">
                {matchedMembers.map((m) => (
                  <div
                    key={m.id}
                    onClick={handleSelectMember}
                    className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50 cursor-pointer border border-slate-200/80 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-900 font-mono mr-2">{m.id}</span>
                        <span className="text-slate-700">{m.name}</span>
                        <span className="text-slate-400 ml-2">({m.totalClaims} claims)</span>
                      </div>
                    </div>
                    <RiskBadge level={m.riskScore >= 70 ? 'HIGH' : 'MEDIUM'} score={m.riskScore} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Facilities */}
          {matchedFacilities.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Facilities
              </span>
              <div className="space-y-1">
                {matchedFacilities.map((f) => (
                  <div
                    key={f.id}
                    onClick={handleSelectFacility}
                    className="p-2.5 rounded-lg bg-slate-50/70 hover:bg-blue-50 cursor-pointer border border-slate-200/80 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-900 font-mono mr-2">{f.id}</span>
                        <span className="text-slate-700">{f.name}</span>
                        <span className="text-slate-400 ml-2">({f.location})</span>
                      </div>
                    </div>
                    <span className="text-slate-600 font-mono text-[11px]">
                      ${(f.totalBilled / 1000).toFixed(0)}k billed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[10px]">Enter</kbd> to open</span>
            <span>Press <kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[10px]">Esc</kbd> to close</span>
          </div>
          <span>Direct navigation to Case Workspace</span>
        </div>
      </div>
    </div>
  );
};
