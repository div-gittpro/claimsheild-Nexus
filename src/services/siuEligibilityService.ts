import { HIGH_PRIORITY_THRESHOLD, Provider } from '../types';

export const SIU_POLICY = {
  riskThreshold: HIGH_PRIORITY_THRESHOLD,
  evidenceThreshold: 50,
  highSeverityEvidenceThreshold: 40,
  networkRiskThreshold: 80,
  networkEvidenceThreshold: 50,
  minimumNetworkEvidenceTypes: 2,
};

export interface SIUEvidenceInput {
  evidenceId: string;
  type: string;
  severity: number;
  claimIds: string[];
}

export interface SIUEligibility {
  eligible: boolean;
  reasons: string[];
  riskScore: number;
  evidenceStrength: number;
  evidenceTypes: string[];
  highSeverityEvidence: boolean;
  networkRisk: number;
  suspiciousExposure: number;
  evidenceIds: string[];
  claimIds: string[];
}

export function evaluateSIUEligibility(
  provider: Provider,
  providerEvidence: SIUEvidenceInput[],
  suspiciousExposure: number,
  policy = SIU_POLICY
): SIUEligibility {
  const reasons: string[] = [];
  const evidenceTypes = Array.from(new Set(providerEvidence.map((item) => item.type)));
  const highSeverityEvidence = providerEvidence.some((item) => item.severity >= 80);
  if (provider.riskScore >= policy.riskThreshold) reasons.push('Risk score exceeds threshold');
  if (provider.evidenceStrength >= policy.evidenceThreshold) reasons.push('Evidence strength exceeds threshold');
  if (evidenceTypes.length >= 2) reasons.push('Multiple independent evidence types detected');
  if (highSeverityEvidence && provider.evidenceStrength >= policy.highSeverityEvidenceThreshold) reasons.push('High-severity evidence and minimum evidence strength detected');
  if (provider.networkRiskScore >= policy.networkRiskThreshold && provider.evidenceStrength >= policy.networkEvidenceThreshold && evidenceTypes.length >= policy.minimumNetworkEvidenceTypes) reasons.push('Network risk, evidence strength, and evidence diversity exceed thresholds');
  const eligible = (provider.riskScore >= policy.riskThreshold && provider.evidenceStrength >= policy.evidenceThreshold) || (highSeverityEvidence && provider.evidenceStrength >= policy.highSeverityEvidenceThreshold) || (provider.networkRiskScore >= policy.networkRiskThreshold && provider.evidenceStrength >= policy.networkEvidenceThreshold && evidenceTypes.length >= policy.minimumNetworkEvidenceTypes);
  if (!eligible && reasons.length === 0) reasons.push('Insufficient evidence for SIU escalation');
  return { eligible, reasons, riskScore: provider.riskScore, evidenceStrength: provider.evidenceStrength, evidenceTypes, highSeverityEvidence, networkRisk: provider.networkRiskScore, suspiciousExposure, evidenceIds: providerEvidence.map((item) => item.evidenceId), claimIds: Array.from(new Set(providerEvidence.flatMap((item) => item.claimIds))) };
}
