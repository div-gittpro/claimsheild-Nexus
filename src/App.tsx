import React from 'react';
import { NexusProvider, useNexus } from './store/useNexusStore';
import { ThemeProvider } from './store/useTheme';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { InvestigatorCopilot } from './components/copilot/InvestigatorCopilot';

import { OverviewView } from './views/OverviewView';
import { SIUQueueView } from './views/SIUQueueView';
import { CasesView } from './views/CasesView';
import { CaseWorkspaceView } from './views/CaseWorkspaceView';
import { ProviderIntelligenceView } from './views/ProviderIntelligenceView';
import { NetworkIntelligenceView } from './views/NetworkIntelligenceView';
import { FWAPatternsView } from './views/FWAPatternsView';
import { DigitalTwinView } from './views/DigitalTwinView';
import { ForecastView } from './views/ForecastView';
import { IngestionView } from './views/IngestionView';
import { ClaimsView } from './views/ClaimsView';
import { PolicyView } from './views/PolicyView';
import { AuditLedgerView } from './views/AuditLedgerView';
import { NotificationsView } from './views/NotificationsView';

const MainContent: React.FC = () => {
  const { activeTab, claims, cases, openCaseByExternalId } = useNexus();

  // Deep link from WhatsApp alerts: /investigations/CASE-00006 opens the workbench.
  React.useEffect(() => {
    const match = window.location.pathname.match(/\/investigations\/([^/?#]+)/i);
    if (match && cases.length > 0) {
      openCaseByExternalId(decodeURIComponent(match[1]));
    }
  }, [cases.length, openCaseByExternalId]);

  if (claims.length === 0) {
    return (
      <div className="min-h-screen cs-app-bg text-slate-800 font-sans antialiased">
        <IngestionView />
      </div>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'OVERVIEW':
        return <OverviewView />;
      case 'SIU_QUEUE':
        return <SIUQueueView />;
      case 'CASES':
        return <CasesView />;
      case 'CASE_DETAIL':
        return <CaseWorkspaceView />;
      case 'PROVIDERS':
        return <ProviderIntelligenceView />;
      case 'NETWORKS':
        return <NetworkIntelligenceView />;
      case 'FWA_PATTERNS':
        return <FWAPatternsView />;
      case 'DIGITAL_TWIN':
        return <DigitalTwinView />;
      case 'FORECAST':
        return <ForecastView />;
      case 'INGESTION':
        return <IngestionView />;
      case 'CLAIMS':
        return <ClaimsView />;
      case 'POLICY':
        return <PolicyView />;
      case 'AUDIT_LEDGER':
        return <AuditLedgerView />;
      case 'NOTIFICATIONS':
        return <NotificationsView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="flex h-screen cs-app-bg text-slate-800 font-sans antialiased overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">{renderActiveView()}</main>
      </div>

      <GlobalSearchModal />
      {cases.length > 0 && <InvestigatorCopilot />}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <NexusProvider>
        <MainContent />
      </NexusProvider>
    </ThemeProvider>
  );
}
