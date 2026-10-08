import { Provider } from '../types';
import { SIU_POLICY, evaluateSIUEligibility, SIUEvidenceInput } from './siuEligibilityService';
import { EvidenceRecord } from './claimsAnalysisService';
import { syncHash256, shortHash } from './hashUtil';

/**
 * Versioned, hashed SIU policy (Sections 26-28).
 *
 * Thresholds mirror the live SIU_POLICY used by the analytical pipeline so the
 * Governance screen reflects the exact rules that generate cases. Every change
 * produces a new immutable version with a content hash, author, timestamp and
 * reason — never silently mutating the active policy.
 */

export interface PolicyThresholds {
  riskThreshold: number;
  evidenceThreshold: number;
  networkRiskThreshold: number;
  highSeverityEvidenceThreshold: number;
}

export interface PolicyVersion {
  version: string; // e.g. v1.2
  thresholds: PolicyThresholds;
  modelVersion: string;
  forecastModel: string;
  aiModel: string;
  author: string;
  effectiveDate: string;
  reason: string;
  hash: string;
  previousHash: string;
}

export const BASE_THRESHOLDS: PolicyThresholds = {
  riskThreshold: SIU_POLICY.riskThreshold,
  evidenceThreshold: SIU_POLICY.evidenceThreshold,
  networkRiskThreshold: SIU_POLICY.networkRiskThreshold,
  highSeverityEvidenceThreshold: SIU_POLICY.highSeverityEvidenceThreshold,
};

export function hashThresholds(
  thresholds: PolicyThresholds,
  version: string,
  previousHash: string,
): string {
  return syncHash256(
    JSON.stringify({ version, thresholds, previousHash }),
  );
}

export function createInitialPolicyVersion(author = 'SIU Policy Lead'): PolicyVersion {
  const version = 'v1.0';
  const previousHash = '0'.repeat(64);
  return {
    version,
    thresholds: { ...BASE_THRESHOLDS },
    modelVersion: 'detector-engine-v1.2',
    forecastModel: 'trajectory-forecast-v1.1',
    aiModel: 'groq-llama-3.3-70b-versatile',
    author,
    effectiveDate: new Date().toISOString(),
    reason: 'Initial policy baseline synchronized with the analytical engine.',
    hash: hashThresholds(BASE_THRESHOLDS, version, previousHash),
    previousHash,
  };
}

/** Produce the next version label (v1.2 -> v1.3). */
export function nextVersionLabel(current: string): string {
  const match = current.match(/^v(\d+)\.(\d+)$/);
  if (!match) return 'v1.1';
  const major = Number(match[1]);
  const minor = Number(match[2]) + 1;
  return `v${major}.${minor}`;
}

export function createPolicyVersion(
  previous: PolicyVersion,
  thresholds: PolicyThresholds,
  reason: string,
  author: string,
): PolicyVersion {
  const version = nextVersionLabel(previous.version);
  return {
    ...previous,
    version,
    thresholds: { ...thresholds },
    author,
    reason,
    effectiveDate: new Date().toISOString(),
    previousHash: previous.hash,
    hash: hashThresholds(thresholds, version, previous.hash),
  };
}

export interface PolicyImpact {
  eligibleCount: number;
  providerIds: string[];
}

/**
 * Recompute how many providers would be SIU-eligible under a given threshold set.
 * Uses the real evaluateSIUEligibility logic so the preview reconciles exactly
 * with the pipeline. Evidence is grouped per provider from the canonical records.
 */
export function computePolicyImpact(
  providers: Provider[],
  evidence: EvidenceRecord[],
  thresholds: PolicyThresholds,
): PolicyImpact {
  const evidenceByProvider = new Map<string, SIUEvidenceInput[]>();
  evidence.forEach((item) => {
    if (item.entityType !== 'PROVIDER') return;
    const list = evidenceByProvider.get(item.entityId) || [];
    list.push({ evidenceId: item.evidenceId, type: item.type, severity: item.severity, claimIds: item.claimIds });
    evidenceByProvider.set(item.entityId, list);
  });

  const policy = {
    ...SIU_POLICY,
    riskThreshold: thresholds.riskThreshold,
    evidenceThreshold: thresholds.evidenceThreshold,
    networkRiskThreshold: thresholds.networkRiskThreshold,
    highSeverityEvidenceThreshold: thresholds.highSeverityEvidenceThreshold,
    networkEvidenceThreshold: thresholds.evidenceThreshold,
  };

  const eligible = providers.filter((provider) => {
    const providerEvidence = evidenceByProvider.get(provider.id) || [];
    return evaluateSIUEligibility(
      provider,
      providerEvidence,
      provider.suspiciousExposure || 0,
      policy,
    ).eligible;
  });

  return { eligibleCount: eligible.length, providerIds: eligible.map((p) => p.id) };
}

export { shortHash };
