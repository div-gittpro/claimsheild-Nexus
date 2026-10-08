import { CaseRecord } from '../types';

export interface SIUCapacityConfig {
  investigatorsCount: number;
  casesPerInvestigator: number;
}

export interface CapacityAllocationResult {
  totalCapacity: number;
  recommendedCases: CaseRecord[];
  backlogCases: CaseRecord[];
  capacityUtilizationPercent: number;
  totalPrioritizedExposure: number;
  totalHighRiskMembersProtected: number;
}

/**
 * Calculates Multi-Objective Priority Rank:
 * Priority = (Risk * 0.35) + (Normalized Exposure * 0.25) + (Member Impact * 0.25) + (Evidence Strength * 0.15)
 */
export function calculateMultiObjectivePriority(c: CaseRecord, maxExposure = 300000): number {
  const normExposure = Math.min(100, (c.estimatedExposure / maxExposure) * 100);
  const score =
    c.riskScore * 0.35 +
    normExposure * 0.25 +
    c.memberImpactScore * 0.25 +
    c.evidenceStrength * 0.15;
  return Math.round(score * 10) / 10;
}

export function optimizeSIUCapacity(
  cases: CaseRecord[],
  config: SIUCapacityConfig
): CapacityAllocationResult {
  const totalCapacity = config.investigatorsCount * config.casesPerInvestigator;

  // Re-rank all cases using Multi-Objective Priority
  const ranked = [...cases]
    .map((c) => ({
      ...c,
      priorityScore: calculateMultiObjectivePriority(c),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((c, index) => ({
      ...c,
      priorityRank: index + 1,
    }));

  const recommendedCases = ranked.slice(0, totalCapacity);
  const backlogCases = ranked.slice(totalCapacity);

  const totalPrioritizedExposure = recommendedCases.reduce((sum, c) => sum + c.estimatedExposure, 0);
  const totalHighRiskMembersProtected = recommendedCases.reduce(
    (sum, c) => sum + c.affectedMembersCount,
    0
  );

  const capacityUtilizationPercent =
    totalCapacity > 0 ? Math.min(100, Math.round((recommendedCases.length / totalCapacity) * 100)) : 0;

  return {
    totalCapacity,
    recommendedCases,
    backlogCases,
    capacityUtilizationPercent,
    totalPrioritizedExposure,
    totalHighRiskMembersProtected,
  };
}
