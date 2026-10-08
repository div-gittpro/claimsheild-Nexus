import React from 'react';
import { useNexus, ActiveTab } from '../../store/useNexusStore';
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  Stethoscope,
  Share2,
  Fingerprint,
  Boxes,
  TrendingUp,
  UploadCloud,
  FileSpreadsheet,
  ScrollText,
  ShieldCheck,
  Bot,
  ArrowLeft,
  FolderOpen,
  BellRing,
} from 'lucide-react';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  heading: string | null;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, currentCase, cases, setCopilotOpen, siuQueue } = useNexus();

  const mustTake = siuQueue.metrics.mustTakeCases;

  const groups: NavGroup[] = [
    {
      heading: null,
      items: [{ id: 'OVERVIEW', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> }],
    },
    {
      heading: 'SIU Operations',
      items: [
        { id: 'SIU_QUEUE', label: 'SIU Queue', icon: <Inbox className="w-4 h-4" /> },
        { id: 'CASES', label: 'Cases', icon: <FolderKanban className="w-4 h-4" /> },
      ],
    },
    {
      heading: 'Intelligence',
      items: [
        { id: 'PROVIDERS', label: 'Providers', icon: <Stethoscope className="w-4 h-4" /> },
        { id: 'NETWORKS', label: 'Networks', icon: <Share2 className="w-4 h-4" /> },
        { id: 'FWA_PATTERNS', label: 'FWA Patterns', icon: <Fingerprint className="w-4 h-4" /> },
        { id: 'DIGITAL_TWIN', label: 'Digital Twin', icon: <Boxes className="w-4 h-4" /> },
        { id: 'FORECAST', label: 'Forecast', icon: <TrendingUp className="w-4 h-4" /> },
      ],
    },
    {
      heading: 'Data',
      items: [
        { id: 'INGESTION', label: 'Ingestion', icon: <UploadCloud className="w-4 h-4" /> },
        { id: 'CLAIMS', label: 'Claims', icon: <FileSpreadsheet className="w-4 h-4" /> },
      ],
    },
    {
      heading: 'Governance',
      items: [
        { id: 'POLICY', label: 'Policy', icon: <ShieldCheck className="w-4 h-4" /> },
        { id: 'AUDIT_LEDGER', label: 'Audit Ledger', icon: <ScrollText className="w-4 h-4" /> },
        { id: 'NOTIFICATIONS', label: 'Notifications', icon: <BellRing className="w-4 h-4" /> },
      ],
    },
  ];

  const isActive = (id: ActiveTab) => {
    if (activeTab === id) return true;
    // Case detail is reached from SIU Queue / Cases; keep Cases highlighted.
    if (activeTab === 'CASE_DETAIL' && id === 'CASES') return true;
    return false;
  };

  return (
    <aside className="cs-chrome-dark w-60 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none z-10">
      <div className="p-3 space-y-4 overflow-y-auto">
        {/* Active case context banner */}
        {activeTab === 'CASE_DETAIL' && currentCase && (
          <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
            <div className="flex items-center justify-between text-[10px] text-blue-300 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-3 h-3" />
                Active Case
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold font-mono">
                Risk {currentCase.riskScore}
              </span>
            </div>
            <div className="font-mono text-xs font-bold text-slate-100 truncate">{currentCase.id}</div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">{currentCase.targetName}</div>
            <button
              onClick={() => setActiveTab('SIU_QUEUE')}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-md bg-slate-700/60 border border-slate-600 text-slate-200 hover:bg-slate-700 text-[10px] font-medium transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Queue</span>
            </button>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={group.heading ?? `g-${gi}`}>
            {group.heading && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.heading}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors text-left ${
                      active
                        ? 'bg-blue-600/20 text-white font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={active ? 'text-blue-300' : 'text-slate-500'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'SIU_QUEUE' && mustTake > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {mustTake}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: Copilot + Responsible AI statement (Section 39) */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <button
          onClick={() => setCopilotOpen(true)}
          disabled={cases.length === 0}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
        >
          <span className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-100" />
            Nexus Copilot
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 text-[10px] text-slate-400 leading-snug">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-0.5">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>Evidence-grounded intelligence</span>
          </div>
          Risk is not proof. AI recommendations require human review.
        </div>
      </div>
    </aside>
  );
};
