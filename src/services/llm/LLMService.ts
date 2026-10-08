import {
  InvestigationEvidencePackage,
  StructuredInvestigationBrief,
  RiskExplanation,
  TwinExplanation,
  InvestigatorChatResponse,
} from './types';

// Section 2 Interface type aliases
export type InvestigationEvidence = InvestigationEvidencePackage;
export type InvestigationBrief = StructuredInvestigationBrief;
export type InvestigatorResponse = InvestigatorChatResponse;

export interface InvestigationContext {
  caseId?: string;
  providerId?: string;
  networkId?: string;
  currentRisk?: number;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface RiskExplanationContext {
  caseId: string;
  providerName: string;
  riskScore: number;
  evidenceBreakdown: any[];
  financialExposure: number;
  memberImpactScore: number;
}

export interface DigitalTwinContext {
  providerName: string;
  providerId: string;
  riskDelta: number;
  timeline: any[];
  whyNowDeltas: any;
}

export interface LLMService {
  generateInvestigationBrief(
    evidence: InvestigationEvidence
  ): Promise<InvestigationBrief>;

  answerInvestigatorQuestion(
    context: InvestigationContext,
    question: string
  ): Promise<InvestigatorResponse>;

  explainRisk(
    context: RiskExplanationContext
  ): Promise<RiskExplanation>;

  explainTwinChange(
    context: DigitalTwinContext
  ): Promise<TwinExplanation>;
}
