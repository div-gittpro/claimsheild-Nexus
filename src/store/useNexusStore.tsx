import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Claim,
  Provider,
  Member,
  Facility,
  NetworkCluster,
  CaseRecord,
  FWARule,
  AuditEvent,
  DigitalTwinTimelinePoint,
  HumanFeedbackOutcome,
  SimulationResult,
  GraphNode,
  GraphEdge,
  AnalysisRun,
} from '../types';
import { optimizeSIUCapacity, SIUCapacityConfig } from '../services/siuCapacityService';
import { runWhatIfSimulation, SimulationParams } from '../services/simulationService';
import { parseCSVText } from '../services/csvParserService';
import { analyzeClaims, ClaimSubmittedEvent, EvidenceRecord } from '../services/claimsAnalysisService';
import { computeSIUQueue } from '../services/siuRecommendationService';
import {
  PolicyVersion,
  PolicyThresholds,
  PolicyImpact,
  createInitialPolicyVersion,
  createPolicyVersion,
  computePolicyImpact,
} from '../services/policyService';
import { buildAuditChain } from '../services/auditLedgerService';
import { notificationService, buildAnalysisSnapshot, NotificationRecord } from '../services/notificationService';

export type ActiveTab =
  // Enterprise information architecture (Section 40)
  | 'OVERVIEW'
  | 'SIU_QUEUE'
  | 'CASES'
  | 'CASE_DETAIL'
  | 'PROVIDERS'
  | 'NETWORKS'
  | 'FWA_PATTERNS'
  | 'DIGITAL_TWIN'
  | 'FORECAST'
  | 'INGESTION'
  | 'CLAIMS'
  | 'POLICY'
  | 'AUDIT_LEDGER'
  | 'NOTIFICATIONS'
  // Legacy aliases (kept for backward compatibility / deep links)
  | 'INVESTIGATIONS'
  | 'ENTITIES'
  | 'INTELLIGENCE'
  | 'ADMINISTRATION'
  | 'COMMAND_CENTER'
  | 'CLAIMS_EXPLORER'
  | 'PROVIDER_INTELLIGENCE'
  | 'NETWORK_INTELLIGENCE'
  | 'RISK_FORECAST'
  | 'INVESTIGATION_WORKBENCH'
  | 'ANALYTICS_REPLAY'
  | 'DATA_MODELS'
  | 'GOVERNANCE';

export type InvestigationsSubTab = 'ACTIVE' | 'ASSIGNED' | 'RESOLVED';
export type EntitiesSubTab = 'PROVIDERS' | 'MEMBERS' | 'FACILITIES' | 'NETWORKS';
export type IntelligenceSubTab = 'RISK' | 'FORECAST' | 'ANALYTICS';
export type AdminSubTab = 'DATA' | 'MODELS' | 'GOVERNANCE';

interface NexusContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  investigationsSubTab: InvestigationsSubTab;
  setInvestigationsSubTab: (sub: InvestigationsSubTab) => void;
  entitiesSubTab: EntitiesSubTab;
  setEntitiesSubTab: (sub: EntitiesSubTab) => void;
  intelligenceSubTab: IntelligenceSubTab;
  setIntelligenceSubTab: (sub: IntelligenceSubTab) => void;
  adminSubTab: AdminSubTab;
  setAdminSubTab: (sub: AdminSubTab) => void;
  openCase: (caseId: string) => void;
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  providers: Provider[];
  claims: Claim[];
  facilities: Facility[];
  members: Member[];
  networks: NetworkCluster[];
  cases: CaseRecord[];
  rules: FWARule[];
  auditLogs: AuditEvent[];
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  selectedProviderId: string;
  setSelectedProviderId: (id: string) => void;
  selectedNetworkId: string;
  setSelectedNetworkId: (id: string) => void;
  timelineIndex: number;
  setTimelineIndex: (idx: number) => void;
  timelinePoints: DigitalTwinTimelinePoint[];
  capacityConfig: SIUCapacityConfig;
  setCapacityConfig: (cfg: SIUCapacityConfig) => void;
  capacityResults: ReturnType<typeof optimizeSIUCapacity>;
  siuQueue: ReturnType<typeof computeSIUQueue>;
  policyVersions: PolicyVersion[];
  activePolicy: PolicyVersion;
  previewPolicyImpact: (thresholds: PolicyThresholds) => PolicyImpact;
  savePolicyVersion: (thresholds: PolicyThresholds, reason: string, author: string) => void;
  auditChain: ReturnType<typeof buildAuditChain>;
  notifications: NotificationRecord[];
  unreadNotifications: number;
  whatsappMode: string | null;
  refreshNotifications: () => void;
  markNotificationsRead: (ids?: string[]) => void;
  openCaseByExternalId: (caseId: string) => void;
  simulationResult: SimulationResult;
  simulationParams: SimulationParams;
  updateSimulationParams: (params: Partial<SimulationParams>) => void;
  toggleRule: (ruleId: string) => void;
  recordInvestigatorFeedback: (
    caseId: string,
    outcome: HumanFeedbackOutcome,
    justification: string,
    investigator: string
  ) => void;
  addCaseNote: (caseId: string, author: string, content: string) => void;
  toggleActionCompleted: (caseId: string, actionId: string) => void;
  uploadClaimsCSV: (csvText: string, filename?: string, forceNewRun?: boolean) => { success: boolean; message: string };
  reprocessDataset: () => { success: boolean; message: string };
  claimEvents: ClaimSubmittedEvent[];
  evidenceRecords: EvidenceRecord[];
  rejectedRows: number;
  integrityErrors: string[];
  currentRun?: AnalysisRun;
  activeDatasetName: string;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  guidedDemoStep: number | null;
  setGuidedDemoStep: (step: number | null) => void;
  currentProvider: Provider;
  currentCase: CaseRecord;
  currentNetwork?: NetworkCluster;
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] };
}

const NexusContext = createContext<NexusContextType | null>(null);
const FWA_RULES_REGISTRY: FWARule[] = [];

export const NexusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTabRaw, setActiveTabRaw] = useState<ActiveTab>('OVERVIEW');
  const [investigationsSubTab, setInvestigationsSubTab] = useState<InvestigationsSubTab>('ACTIVE');
  const [entitiesSubTab, setEntitiesSubTab] = useState<EntitiesSubTab>('PROVIDERS');
  const [intelligenceSubTab, setIntelligenceSubTab] = useState<IntelligenceSubTab>('RISK');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('DATA');
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [networks, setNetworks] = useState<NetworkCluster[]>([]);
  const [rules, setRules] = useState<FWARule[]>(FWA_RULES_REGISTRY);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [claimEvents, setClaimEvents] = useState<ClaimSubmittedEvent[]>([]);
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [rejectedRows, setRejectedRows] = useState(0);
  const [integrityErrors, setIntegrityErrors] = useState<string[]>([]);
  const [currentRun, setCurrentRun] = useState<AnalysisRun>();
  const [runSequence, setRunSequence] = useState(0);
  const [datasetFingerprint, setDatasetFingerprint] = useState('');
  const [lastDatasetText, setLastDatasetText] = useState('');
  const [lastDatasetFilename, setLastDatasetFilename] = useState('');
  const [processedEventIds, setProcessedEventIds] = useState<Set<string>>(new Set());

  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('');
  const [timelineIndex, setTimelineIndex] = useState<number>(0);

  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [guidedDemoStep, setGuidedDemoStep] = useState<number | null>(null);

  const [capacityConfig, setCapacityConfig] = useState<SIUCapacityConfig>({
    investigatorsCount: 5,
    casesPerInvestigator: 4,
  });

  const [policyVersions, setPolicyVersions] = useState<PolicyVersion[]>(() => [
    createInitialPolicyVersion(),
  ]);
  const activePolicy = policyVersions[policyVersions.length - 1];

  const [simulationParams, setSimulationParams] = useState<SimulationParams>({
    claimGrowthPercent: 40,
    referralGrowthPercent: 20,
    networkExpansionCount: 2,
    highValueSpikePercent: 35,
    interventionIntensityPercent: 65,
  });

  const currentProvider = useMemo(() => {
    return providers.find((p) => p.id === selectedProviderId) || providers[0];
  }, [providers, selectedProviderId]);

  const currentCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || cases[0];
  }, [cases, selectedCaseId]);

  const currentNetwork = useMemo(() => {
    return networks.find((n) => n.id === selectedNetworkId) || networks[0];
  }, [networks, selectedNetworkId]);

  const [timelinePoints, setTimelinePoints] = useState<DigitalTwinTimelinePoint[]>([]);

  const capacityResults = useMemo(() => {
    return optimizeSIUCapacity(cases, capacityConfig);
  }, [cases, capacityConfig]);

  const siuQueue = useMemo(() => {
    return computeSIUQueue(cases, capacityConfig);
  }, [cases, capacityConfig]);

  // Audit ledger is chained oldest -> newest. The store keeps logs newest-first.
  const auditChain = useMemo(() => {
    return buildAuditChain([...auditLogs].reverse());
  }, [auditLogs]);

  // ---- WhatsApp notification pipeline (backend-driven) ----
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [whatsappMode, setWhatsappMode] = useState<string | null>(null);
  const ingestedRunRef = useRef<string>('');

  const refreshNotifications = useCallback(async () => {
    const data = await notificationService.list(50);
    if (data) {
      setNotifications(data.notifications);
      setUnreadNotifications(data.unreadCount);
    }
  }, []);

  const markNotificationsRead = useCallback(async (ids?: string[]) => {
    const data = await notificationService.markRead(ids);
    if (data) setUnreadNotifications(data.unreadCount);
    setNotifications((prev) => prev.map((n) => (!ids || ids.includes(n.notificationId) ? { ...n, read: true } : n)));
  }, []);

  // Fetch provider mode once.
  useEffect(() => {
    notificationService.getConfig().then((c) => c && setWhatsappMode(c.mode));
  }, []);

  // When a new analysis run completes, post the snapshot so the backend can
  // derive events and generate alerts. The analytical state is never mutated.
  useEffect(() => {
    if (!currentRun || cases.length === 0) return;
    if (ingestedRunRef.current === currentRun.runId) return;
    ingestedRunRef.current = currentRun.runId;
    const snapshot = buildAnalysisSnapshot(currentRun.runId, cases, providers, networks);
    notificationService.ingest(snapshot).then(() => refreshNotifications());
  }, [currentRun, cases, providers, networks, refreshNotifications]);

  // Light polling so delivery-status transitions (SENT -> DELIVERED -> READ) surface.
  useEffect(() => {
    if (!currentRun) return;
    const timer = setInterval(() => refreshNotifications(), 5000);
    return () => clearInterval(timer);
  }, [currentRun, refreshNotifications]);

  const previewPolicyImpact = (thresholds: PolicyThresholds): PolicyImpact => {
    return computePolicyImpact(providers, evidenceRecords, thresholds);
  };

  const savePolicyVersion = (thresholds: PolicyThresholds, reason: string, author: string) => {
    setPolicyVersions((prev) => {
      const next = createPolicyVersion(prev[prev.length - 1], thresholds, reason, author);
      return [...prev, next];
    });
    const newAudit: AuditEvent = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      actor: author,
      action: 'POLICY_VERSION_SAVED',
      entityType: 'POLICY',
      entityId: reason.slice(0, 40),
      details: `Saved new policy version. Risk ${thresholds.riskThreshold}, Evidence ${thresholds.evidenceThreshold}, Network ${thresholds.networkRiskThreshold}. Reason: "${reason}".`,
    };
    setAuditLogs((logs) => [newAudit, ...logs]);
  };

  const simulationResult = useMemo(() => {
    return runWhatIfSimulation(
      currentProvider?.riskScore || 0,
      currentProvider?.estimatedExposure || 0,
      (currentProvider?.connectedFacilityIds.length || 0),
      simulationParams
    );
  }, [currentProvider, simulationParams]);

  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  const updateSimulationParams = (params: Partial<SimulationParams>) => {
    setSimulationParams((prev) => ({ ...prev, ...params }));
  };

  const toggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === ruleId) {
          const nextState = !r.enabled;
          // Log audit
          const newAudit: AuditEvent = {
            id: `AUD-${Date.now().toString().slice(-4)}`,
            timestamp: new Date().toISOString(),
            actor: 'SIU Manager / Policy Admin',
            action: nextState ? 'RULE_ENABLED' : 'RULE_DISABLED',
            entityType: 'FWA_RULE',
            entityId: ruleId,
            details: `Rule ${ruleId} (${r.name}) was toggled to ${nextState ? 'ENABLED' : 'DISABLED'}.`,
          };
          setAuditLogs((logs) => [newAudit, ...logs]);
          return { ...r, enabled: nextState };
        }
        return r;
      })
    );
  };

  const recordInvestigatorFeedback = (
    caseId: string,
    outcome: HumanFeedbackOutcome,
    justification: string,
    investigator: string
  ) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          let updatedStatus = c.status;
          if (outcome === 'CONFIRMED_FWA' || outcome === 'LIKELY_FWA') {
            updatedStatus = 'RESOLVED_FWA';
          } else if (outcome === 'NOT_FWA') {
            updatedStatus = 'CLOSED_NOT_FWA';
          } else if (outcome === 'FALSE_POSITIVE') {
            updatedStatus = 'FALSE_POSITIVE';
          } else {
            updatedStatus = 'EVIDENCE_REQUESTED';
          }

          return {
            ...c,
            status: updatedStatus,
            humanFeedback: {
              outcome,
              justification,
              recordedAt: new Date().toISOString(),
              investigator,
            },
          };
        }
        return c;
      })
    );

    const newAudit: AuditEvent = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      actor: investigator,
      action: 'HUMAN_FEEDBACK_RECORDED',
      entityType: 'CASE',
      entityId: caseId,
      details: `Investigator recorded decision: ${outcome}. Rationale: "${justification}". Stored to feedback loop.`,
    };
    setAuditLogs((logs) => [newAudit, ...logs]);
  };

  const addCaseNote = (caseId: string, author: string, content: string) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            investigatorNotes: [
              ...c.investigatorNotes,
              {
                id: `NOTE-${Date.now().toString().slice(-4)}`,
                author,
                timestamp: new Date().toISOString(),
                content,
              },
            ],
          };
        }
        return c;
      })
    );
    const newAudit: AuditEvent = {
      id: `AUD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      actor: author,
      action: 'NOTE_ADDED',
      entityType: 'CASE',
      entityId: caseId,
      details: `Added case log: "${content.slice(0, 60)}..."`,
    };
    setAuditLogs((logs) => [newAudit, ...logs]);
  };

  const toggleActionCompleted = (caseId: string, actionId: string) => {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id === caseId) {
          return {
            ...c,
            recommendedActions: c.recommendedActions.map((act) =>
              act.id === actionId ? { ...act, completed: !act.completed } : act
            ),
          };
        }
        return c;
      })
    );
  };

  const [activeDatasetName, setActiveDatasetName] = useState<string>('No dataset loaded');

  const uploadClaimsCSV = (csvText: string, filename = 'Uploaded_Claims.csv', forceNewRun = false) => {
    try {
      const fingerprint = `${filename}:${csvText}`;
      if (!forceNewRun && fingerprint === datasetFingerprint && currentRun) {
        return { success: true, message: `${currentRun.claimCount} claims already processed in ${currentRun.runId}.` };
      }
      const records = parseCSVText(csvText);
      if (records.length === 0) {
        return { success: false, message: 'No valid data rows found in CSV file.' };
      }

      const nextRunNumber = runSequence + 1;
      const runId = `RUN-${String(nextRunNumber).padStart(5, '0')}`;
      const snapshot = analyzeClaims(records, new Set<string>(), runId, filename);
      if (snapshot.claims.length === 0) {
        return { success: false, message: 'No valid claims found in CSV file.' };
      }

      setClaims(snapshot.claims);
      setProviders(snapshot.providers);
      setMembers(snapshot.members);
      setFacilities(snapshot.facilities);
      setNetworks(snapshot.networks);
      setCases(snapshot.cases);
      setClaimEvents(snapshot.events);
      setEvidenceRecords(snapshot.evidence);
      setRejectedRows(snapshot.rejectedRows);
      setIntegrityErrors(snapshot.integrityErrors);
      setCurrentRun(snapshot.analysisRun);
      setRunSequence(nextRunNumber);
      setDatasetFingerprint(fingerprint);
      setLastDatasetText(csvText);
      setLastDatasetFilename(filename);
      setTimelinePoints(snapshot.timelinePoints);
      setGraphData(snapshot.graphData);
      setProcessedEventIds(new Set(records.map((record) => record.claim_id || record.id).filter(Boolean).map((claimId) => `evt_${claimId}`)));
      setSelectedProviderId(snapshot.providers[0]?.id || '');
      setSelectedCaseId(snapshot.cases[0]?.id || '');
      setSelectedNetworkId(snapshot.networks[0]?.id || '');
      setActiveTabRaw('OVERVIEW');

      setActiveDatasetName(filename);

      const newAudit: AuditEvent = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        actor: 'User / CSV Intake',
        action: 'DATA_UPLOADED',
        entityType: 'CLAIMS_BATCH',
        entityId: filename,
        details: `Successfully ingested ${snapshot.claims.length} claims across ${snapshot.providers.length} providers. Generated ${snapshot.cases.length} SIU cases and ${snapshot.events.length} ClaimSubmitted events.`,
      };
      setAuditLogs((logs) => [newAudit, ...logs]);

      return {
        success: true,
        message: `${snapshot.claims.length} claims imported, ${snapshot.claims.length - snapshot.rejectedRows} valid, ${snapshot.rejectedRows} rejected, ${snapshot.events.length} ClaimSubmitted events generated, ${snapshot.evidence.length} evidence records generated.`,
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Error processing CSV file.' };
    }
  };

  const reprocessDataset = () => {
    if (!lastDatasetText) return { success: false, message: 'No dataset is available to reprocess.' };
    setDatasetFingerprint('');
    return uploadClaimsCSV(lastDatasetText, lastDatasetFilename, true);
  };

  // Map legacy aliases onto the enterprise information architecture.
  const LEGACY_ALIASES: Record<string, ActiveTab> = {
    COMMAND_CENTER: 'OVERVIEW',
    INVESTIGATIONS: 'CASES',
    ENTITIES: 'PROVIDERS',
    INTELLIGENCE: 'FORECAST',
    ADMINISTRATION: 'INGESTION',
    INVESTIGATION_WORKBENCH: 'CASE_DETAIL',
    PROVIDER_INTELLIGENCE: 'PROVIDERS',
    NETWORK_INTELLIGENCE: 'NETWORKS',
    RISK_FORECAST: 'FORECAST',
    ANALYTICS_REPLAY: 'FORECAST',
    DATA_MODELS: 'FWA_PATTERNS',
    GOVERNANCE: 'POLICY',
    CLAIMS_EXPLORER: 'CLAIMS',
  };

  const setActiveTab = (tab: ActiveTab) => {
    const resolved = LEGACY_ALIASES[tab] ?? tab;
    setActiveTabRaw(resolved);
  };

  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    const targetCase = cases.find((c) => c.id === caseId);
    if (targetCase) {
      setSelectedProviderId(targetCase.targetId);
    }
    setActiveTabRaw('CASE_DETAIL');
  };

  // Deep-link entry point (from WhatsApp "Open investigation"): tolerant of
  // casing and falls back to the SIU queue when the case is not loaded.
  const openCaseByExternalId = (caseId: string) => {
    const match = cases.find((c) => c.id.toLowerCase() === caseId.toLowerCase());
    if (match) {
      openCase(match.id);
    } else {
      setActiveTabRaw('SIU_QUEUE');
    }
  };

  return (
    <NexusContext.Provider
      value={{
        activeTab: activeTabRaw,
        setActiveTab,
        investigationsSubTab,
        setInvestigationsSubTab,
        entitiesSubTab,
        setEntitiesSubTab,
        intelligenceSubTab,
        setIntelligenceSubTab,
        adminSubTab,
        setAdminSubTab,
        openCase,
        copilotOpen,
        setCopilotOpen,
        providers,
        claims,
        facilities,
        members,
        networks,
        cases,
        rules,
        auditLogs,
        claimEvents,
        evidenceRecords,
        rejectedRows,
        integrityErrors,
        currentRun,
        selectedCaseId,
        setSelectedCaseId,
        selectedProviderId,
        setSelectedProviderId,
        selectedNetworkId,
        setSelectedNetworkId,
        timelineIndex,
        setTimelineIndex,
        timelinePoints,
        capacityConfig,
        setCapacityConfig,
        capacityResults,
        siuQueue,
        policyVersions,
        activePolicy,
        previewPolicyImpact,
        savePolicyVersion,
        auditChain,
        notifications,
        unreadNotifications,
        whatsappMode,
        refreshNotifications,
        markNotificationsRead,
        openCaseByExternalId,
        simulationResult,
        simulationParams,
        updateSimulationParams,
        toggleRule,
        recordInvestigatorFeedback,
        addCaseNote,
        toggleActionCompleted,
        uploadClaimsCSV,
        reprocessDataset,
        activeDatasetName,
        searchOpen,
        setSearchOpen,
        guidedDemoStep,
        setGuidedDemoStep,
        currentProvider,
        currentCase,
        currentNetwork,
        graphData,
      }}
    >
      {children}
    </NexusContext.Provider>
  );
};

export function useNexus() {
  const ctx = useContext(NexusContext);
  if (!ctx) {
    throw new Error('useNexus must be used within a NexusProvider');
  }
  return ctx;
}
