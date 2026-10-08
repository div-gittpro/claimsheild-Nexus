import { CaseRecord, EvidenceItem, DigitalTwinTimelinePoint, SimulationResult } from '../../types';

export interface InvestigationEvidencePackage {
  case: {
    caseId: string;
    status: string;
    priority: number;
    title: string;
  };
  provider: {
    providerId: string;
    name: string;
    specialty: string;
    riskScore: number;
    evidenceStrength: number;
    peerDeviationFactor: number;
  };
  claimSignals: {
    evidenceId: string;
    type: string;
    count: number;
    severity: string;
    detail: string;
    citations: string[];
  }[];
  behaviorSignals: {
    evidenceId: string;
    metric: string;
    value: number;
    peerBaseline: number;
    unit: string;
  }[];
  networkSignals: {
    evidenceId: string;
    type: string;
    value: string | number;
    relatedEntityId?: string;
  }[];
  timeline: {
    date: string;
    risk: number;
    note: string;
  }[];
  forecast: {
    horizon30d: number;
    horizon60d: number;
    horizon90d: number;
    confidence: number;
  };
  financial: {
    currentExposure: number;
    projected90dExposure: number;
  };
  memberImpact: {
    severity: string;
    affectedCount: number;
    impactScore: number;
  };
}

export interface StructuredInvestigationBrief {
  executiveSummary: string;
  riskInterpretation: string;
  keyEvidence: {
    evidenceId: string;
    finding: string;
    significance: string;
  }[];
  timeline: {
    date: string;
    event: string;
    evidenceId?: string;
  }[];
  networkContext: {
    finding: string;
    evidenceId?: string;
  }[];
  financialImpact: string;
  memberImpact: string;
  futureRisk: {
    horizon: '30D' | '60D' | '90D';
    interpretation: string;
  }[];
  recommendedActions: {
    action: string;
    evidenceIds: string[];
  }[];
  limitations: string[];
  confidenceStatement: string;
  generatedAt?: string;
  modelVersion?: string;
  isAiGenerated?: boolean;
}

export interface RiskExplanation {
  summary: string;
  primaryDrivers: {
    title: string;
    description: string;
    evidenceId?: string;
  }[];
  investigatorGuidance: string;
}

export interface TwinExplanation {
  stateSummary: string;
  majorChanges: string[];
  riskTrajectory: string;
  networkChanges: string;
  potentialImplications: string;
  limitations: string;
}

export interface InvestigatorChatResponse {
  answer: string;
  citedEvidenceIds: string[];
  suggestedFollowUps?: string[];
  toolsUsed?: string[];
}
