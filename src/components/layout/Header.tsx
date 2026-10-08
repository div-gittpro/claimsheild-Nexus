import React from 'react';
import { useNexus } from '../../store/useNexusStore';
import { useTheme } from '../../store/useTheme';
import { Search, UploadCloud, Bot, Database, Sun, Moon } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';

export const Header: React.FC = () => {
  const { setSearchOpen, setActiveTab, activeDatasetName, claims, setCopilotOpen, cases } = useNexus();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold font-mono text-sm">
          CS
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-900 tracking-tight">ClaimShield Nexus</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200">
              Enterprise SIU
            </span>
          </div>
          <p className="text-[11px] text-slate-500 -mt-0.5">Healthcare Investigation & Pattern Intelligence</p>
        </div>
      </div>

      {/* Search + actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 transition-colors text-xs w-80 justify-between"
          title="Search claims, providers, members, facilities, cases..."
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Search claims, providers, members, facilities, cases...</span>
          </span>
          <kbd className="px-1.5 py-0.5 rounded bg-white text-[10px] font-mono text-slate-400 border border-slate-200">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={() => setActiveTab('INGESTION')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
          title="Open the data ingestion workspace"
        >
          <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
          <span>Data Ingestion</span>
        </button>

        <button
          onClick={() => setActiveTab('CLAIMS')}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
          title="View current dataset claims"
        >
          <Database className="w-3 h-3 text-blue-600" />
          <span className="truncate max-w-[140px] font-medium">{activeDatasetName}</span>
          <span className="text-[11px] text-slate-500">({claims.length} claims)</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <NotificationBell />

        <button
          onClick={() => setCopilotOpen(true)}
          disabled={cases.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
          title="Open Nexus Copilot"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nexus Copilot</span>
        </button>
      </div>
    </header>
  );
};
