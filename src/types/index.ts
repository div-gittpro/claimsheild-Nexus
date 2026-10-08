export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL';
export const HIGH_PRIORITY_THRESHOLD = 75;

export interface ProviderRiskState {
  analysisRunId?: string;
  providerId: string;
  currentRisk: number;
  evidenceStrength: number;
  networkRisk: number;
  suspiciousExposure: number;
  affectedMembers: number;
  priorityScore: number;
  riskHistory: { timestamp: string; risk: number; evidenceIds: string[] }[];
  riskDrivers: { type: string; contribution: number; component: number }[];
  lastUpdated: string;
}

export interface AnalysisRun {
  runId: string;
  datasetName: string;
  createdAt: string;
  claimCount: number;
  status: 'INGESTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export type FWACategory =
  | 'DUPLICATE_BILLING'
  | 'UPCODING'
  | 'UNBUNDLING'
  | 'EXCESSIVE_UTILIZATION'
  | 'IMPOSSIBLE_TIMING'
  | 'PHANTOM_SERVICE'
  | 'REFERRAL_CONCENTRATION'
  | 'COORDINATED_NETWORK';

export type CaseStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'EVIDENCE_REQUESTED'
  | 'FIELD_INTERVIEW'
  | 'REFERRED_TO_LEGAL'
  | 'RESOLVED_FWA'
  | 'CLOSED_NOT_FWA'
  | 'FALSE_POSITIVE';

export type HumanFeedbackOutcome =
  | 'CONFIRMED_FWA'
  | 'LIKELY_FWA'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NOT_FWA'
  | 'FALSE_POSITIVE';

export type NodeType =
  | 'PROVIDER'
  | 'MEMBER'
  | 'FACILITY'
  | 'CLAIM'
  | 'REFERRAL'
  | 'LOCATION'
  | 'INVESTIGATION';

export type EdgeType =
  | 'TREATS'
  | 'REFERS'
  | 'OPERATES'
  | 'OWNS'
  | 'SUBMITTED'
  | 'LOCATED_AT'
  | 'INVOLVED_IN';

export interface Claim {
  analysisRunId?: string;
  id: string;
  claimNumber: string;
  providerId: string;
  providerName: string;
  memberId: string;
  memberName: string;
  facilityId: string;
  facilityName: string;
  serviceDate: string;
  submissionDate: string;
  procedureCode: string; // e.g. CPT 99215, 29881
  procedureDescription: string;
  diagnosisCode: string; // e.g. M54.5, M17.11
  billedAmount: number;
  allowedAmount: number;
  paidAmount: number;
  status: 'PAID' | 'PENDING' | 'DENIED' | 'FLAGGED';
  riskScore: number;
  flags: string[];
  ruleViolations: {
    ruleId: string;
    ruleName: string;
    score: number;
    severity: RiskLevel;
    evidence: string;
  }[];
  temporalOverlap?: boolean;
  distanceFromPreviousMiles?: number;
  minutesFromPrevious?: number;
}

export interface Provider {
  analysisRunId?: string;
  id: string; // e.g. P1029
  npi: string;
  name: string;
  specialty: string;
  location: string;
  address: string;
  lat: number;
  lng: number;
  riskScore: number;
  riskLevel: RiskLevel;
  trendDirection: 'UP' | 'DOWN' | 'STABLE';
  trendDelta30d: number;
  claimsCount: number;
  totalBilled: number;
  avgClaimAmount: number;
  memberCount: number;
  referralDensity: number; // 0-1
  peerDeviationFactor: number; // e.g. 4.2x
  networkId?: string;
  networkRiskScore: number;
  estimatedExposure: number;
  totalExposure?: number;
  suspiciousExposure?: number;
  potentiallyAvoidableExposure?: number;
  projectedExposure30d: number;
  projectedExposure60d: number;
  projectedExposure90d: number;
  forecast30d: number;
  forecast60d: number;
  forecast90d: number;
  forecastConfidence: number;
  evidenceStrength: number;
  peerComparisons: {
    metric: string;
    providerVal: number;
    peerVal: number;
    unit: string;
    ratio: number;
  }[];
  connectedFacilityIds: string[];
  topProcedures: { code: string; count: number; billed: number }[];
  evidenceCount?: number;
  evidenceTypes?: string[];
  riskStateVersion?: string;
  riskCalculatedAt?: string;
  riskDrivers?: { type: string; contribution: number; component: number }[];
  riskHistory?: { timestamp: string; riskScore: number; reason: string; evidenceIds: string[] }[];
  affectedMembers?: number;
  siuEligible?: boolean;
  siuEligibilityReasons?: string[];
  siuStatus?: 'SIU_CASE' | 'MONITORED' | 'NETWORK_MONITORING';
  riskState?: ProviderRiskState;
  isFlagship?: boolean;
}

export interface Member {
  analysisRunId?: string;
  id: string; // e.g. M-4819
  name: string;
  dob: string;
  gender: 'M' | 'F' | 'OTHER';
  riskScore: number;
  totalClaims: number;
  totalPaid: number;
  impactTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impactFactors: string[];
  assignedProviderId?: string;
}

export interface Facility {
  analysisRunId?: string;
  id: string; // e.g. F091
  name: string;
  facilityType: 'AMBULATORY_SURGICAL' | 'DIAGNOSTIC_IMAGING' | 'HOSPITAL' | 'PAIN_CLINIC';
  location: string;
  address: string;
  lat: number;
  lng: number;
  riskScore: number;
  activeProviders: string[];
  claimsProcessed: number;
  totalBilled: number;
  flaggedRate: number;
}

export interface ReferralEdge {
  id: string;
  fromProviderId: string;
  toProviderId: string;
  referralCount: number;
  volumeSharePercent: number; // e.g. 68%
  suspiciousScore: number;
  firstDate: string;
  lastDate: string;
}

export interface NetworkCluster {
  analysisRunId?: string;
  id: string; // e.g. N-017
  name: string;
  riskScore: number;
  riskLevel: RiskLevel;
  providerCount: number;
  memberCount: number;
  facilityCount: number;
  totalClaimsCount: number;
  estimatedExposure: number;
  projectedExposure90d: number;
  primarySpecialty: string;
  referralDensity: number;
  sharedLocationsCount: number;
  sharedOwnershipFlags: boolean;
  trajectory: 'ESCALATING' | 'STABLE' | 'DE-ESCALATING';
  suspiciousSignals: string[];
  topProviders: { id: string; name: string; risk: number; specialty: string }[];
  topFacilities: { id: string; name: string; risk: number }[];
  propagationPath: {
    sourceId: string;
    sourceRisk: number;
    targetId: string;
    targetExposure: number;
    rationale: string;
  }[];
}

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: NodeType;
  riskScore: number;
  riskLevel: RiskLevel;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  isFlagship?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  weight?: number;
  isSuspicious?: boolean;
}

export interface FWARule {
  id: string; // e.g. FWA-001
  name: string;
  category: FWACategory;
  severity: RiskLevel;
  description: string;
  detectionLogic: string;
  evidenceRequirements: string;
  recommendedAction: string;
  enabled: boolean;
  triggersCount: number;
}

export interface EvidenceItem {
  id: string;
  ruleId: string;
  ruleName: string;
  category: FWACategory;
  title: string;
  description: string;
  contributionScore: number; // e.g. +17
  weightPercentage: number;
  supportingRecordIds: string[];
  severity: RiskLevel;
  observedFact: string;
  modelInference: string;
  timestamp: string;
}

export interface CaseRecord {
  analysisRunId?: string;
  id: string; // e.g. CASE-1042
  title: string;
  priorityScore: number; // multi-objective
  priorityRank: number;
  targetType: 'PROVIDER' | 'NETWORK' | 'FACILITY';
  targetId: string;
  providerId?: string;
  claimIds?: string[];
  evidenceIds?: string[];
  targetName: string;
  networkId?: string;
  networkName?: string;
  specialty?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  evidenceStrength: number;
  forecastConfidence: number;
  estimatedExposure: number;
  totalExposure?: number;
  suspiciousExposure?: number;
  potentiallyAvoidableExposure?: number;
  evidenceTypes?: string[];
  memberImpactTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  memberImpactScore: number;
  potentialUnnecessaryProcedures: number;
  affectedMembersCount: number;
  networkRiskScore: number;
  forecast30d: number;
  forecast60d: number;
  forecast90d: number;
  status: CaseStatus;
  assignedInvestigator: string;
  slaDaysRemaining: number;
  lastUpdated: string;
  createdAt: string;
  evidenceBreakdown: EvidenceItem[];
  whyNowDeltas: {
    claimVelocityChange: number; // e.g. +41
    highValueClaimSpike: number; // e.g. +58
    referralDensityChange: number; // e.g. +27
    networkEntitiesAdded: number; // e.g. +2
    riskDelta30d: number; // e.g. +36
  };
  recommendedActions: {
    id: string;
    actionText: string;
    category: string;
    completed: boolean;
  }[];
  investigatorNotes: {
    id: string;
    author: string;
    timestamp: string;
    content: string;
  }[];
  brief?: InvestigationBrief;
  humanFeedback?: {
    outcome: HumanFeedbackOutcome;
    justification: string;
    recordedAt: string;
    investigator: string;
  };
}

export interface InvestigationBrief {
  generatedAt: string;
  caseId: string;
  providerId: string;
  providerName: string;
  modelUsed: string;
  executiveSummary: string;
  whyFlagged: string[];
  keyEvidence: {
    evidenceId: string;
    finding: string;
    citations: string[];
  }[];
  timelineSummary: string;
  networkContext: string;
  financialImpactAnalysis: string;
  memberImpactAnalysis: string;
  predictiveRiskTrajectory: string;
  recommendedInvestigatorActions: string[];
  limitationsAndUncertainty: string;
  isAiGenerated: boolean;
}

export interface DigitalTwinTimelinePoint {
  periodLabel: string; // '90 Days Ago' | '60 Days Ago' | '30 Days Ago' | 'Today' | '30D Forecast' | '60D Forecast' | '90D Forecast'
  daysOffset: number; // -90, -60, -30, 0, 30, 60, 90
  isFuture: boolean;
  riskScore: number;
  claimVolume: number;
  networkDegree: number;
  estimatedExposure: number;
  referralDensity: number;
  anomalyScore: number;
  summaryNote: string;
}

export interface SimulationResult {
  scenarioA: {
    name: string;
    description: string;
    risk30d: number;
    risk60d: number;
    risk90d: number;
    exposure90d: number;
    networkSize90d: number;
  };
  scenarioB: {
    name: string;
    description: string;
    risk30d: number;
    risk60d: number;
    risk90d: number;
    exposure90d: number;
    networkSize90d: number;
  };
  parameters: {
    claimGrowthPercent: number;
    referralGrowthPercent: number;
    networkExpansionCount: number;
    highValueSpikePercent: number;
    interventionIntensityPercent: number;
  };
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}
