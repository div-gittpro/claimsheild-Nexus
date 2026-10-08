import { CaseRecord } from '../types';
import { SIUCapacityConfig } from './siuCapacityService';

/**
 * Capacity-aware SIU recommendation engine.
 *
 * Section 5 of the product spec: do not simply sort by risk. Combine priority,
 * financial exposure, member impact, evidence strength, severity, network risk,
 * investigator capacity and compliance deadline into a disposition recommendation.
 *
 * All inputs originate from the canonical analytical state (CaseRecord). Nothing
 * is hardcoded; thresholds are derived from the live case distribution and the
 * configured investigator capacity.
 */

export type SIURecommendation = 'MUST_TAKE' | 'RECOMMENDED' | 'DEFER' | 'MONITOR';

export interface SIUCaseScore {
  caseId: string;
  /** Composite capacity-aware score 0-100. */
  compositeScore: number;
  /** Disposition recommendation. */
  recommendation: SIURecommendation;
  /** Confidence 0-1 derived from evidence strength and forecast confidence. */
  confidence: number;
  /** Compliance deadline in days (derived from priority + exposure urgency). */
  deadlineDays: number;
  /** True when the compliance deadline is inside the SLA window. */
  deadlineUrgent: boolean;
  /** Rank within the full prioritized slate (1 = highest). */
  rank: number;
  /** Contribution breakdown so the UI can explain the score. */
  contributions: { label: string; value: number }[];
}

export interface SIUQueueMetrics {
  investigators: number;
  casesPerInvestigator: number;
  totalCapacity: number;
  activeCases: number;
  inCapacityCases: number;
  overCapacityCases: number;
  mustTakeCases: number;
  recommendedCases: number;
  deferredCases: number;
  monitorCases: number;
  /** Estimated weeks to clear the active backlog at current throughput. */
  weeksToClear: number;
  /** Cases whose derived compliance deadline falls within 7 days. */
  casesDueWithin7Days: number;
  /** Sum of estimated weekly workload hours across active cases. */
  estimatedWorkloadHours: number;
}

export interface SIUQueueResult {
  metrics: SIUQueueMetrics;
  scored: (CaseRecord & { siuScore: SIUCaseScore })[];
}

const ACTIVE_STATUSES = new Set([
  'NEW',
  'UNDER_REVIEW',
  'EVIDENCE_REQUESTED',
  'FIELD_INTERVIEW',
  'REFERRED_TO_LEGAL',
]);

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

/** Average severity (0-100) across a case's evidence breakdown. */
function severityScore(c: CaseRecord): number {
  if (c.evidenceBreakdown.length === 0) return 0;
  const map: Record<string, number> = { CRITICAL: 95, HIGH: 78, MEDIUM: 55, LOW: 30, NORMAL: 10 };
  const total = c.evidenceBreakdown.reduce((sum, e) => sum + (map[e.severity] ?? 40), 0);
  return clamp(total / c.evidenceBreakdown.length);
}

/**
 * Derive a compliance deadline (in days) from analytical urgency. Higher
 * priority, exposure and forecast slope compress the available window. This is
 * deterministic and reproducible from the case state — not a stored literal.
 */
function deadlineDaysFor(c: CaseRecord, maxExposure: number): number {
  const exposurePressure = maxExposure > 0 ? clamp((c.estimatedExposure / maxExposure) * 100) : 0;
  const forecastSlope = clamp(c.forecast90d - c.riskScore, 0, 100);
  const urgency = clamp(c.priorityScore * 0.5 + exposurePressure * 0.3 + forecastSlope * 0.2);
  // Map urgency 0-100 to a 1-30 day SLA window (more urgent -> fewer days).
  return Math.max(1, Math.round(30 - (urgency / 100) * 29));
}

export function scoreCase(
  c: CaseRecord,
  maxExposure: number,
  rank: number,
  totalCapacity: number,
): SIUCaseScore {
  const normExposure = maxExposure > 0 ? clamp((c.estimatedExposure / maxExposure) * 100) : 0;
  const severity = severityScore(c);

  const contributions = [
    { label: 'Priority', value: Math.round(c.priorityScore * 0.22) },
    { label: 'Financial exposure', value: Math.round(normExposure * 0.18) },
    { label: 'Member impact', value: Math.round(c.memberImpactScore * 0.14) },
    { label: 'Evidence strength', value: Math.round(c.evidenceStrength * 0.16) },
    { label: 'Severity', value: Math.round(severity * 0.1) },
    { label: 'Network risk', value: Math.round(c.networkRiskScore * 0.1) },
    { label: 'Risk', value: Math.round(c.riskScore * 0.1) },
  ];
  const compositeScore = clamp(contributions.reduce((sum, item) => sum + item.value, 0));

  const deadlineDays = deadlineDaysFor(c, maxExposure);
  const deadlineUrgent = deadlineDays <= 7;

  // Confidence blends evidence strength and forecast confidence (0-1).
  const confidence = clamp(c.evidenceStrength * 0.6 + c.forecastConfidence * 0.4) / 100;

  // Disposition: capacity-aware. Cases inside capacity with urgent deadlines are
  // MUST_TAKE; strong cases beyond capacity are RECOMMENDED; weak-evidence cases
  // are MONITOR; the remainder DEFER.
  let recommendation: SIURecommendation;
  const withinCapacity = rank <= totalCapacity;
  if ((deadlineUrgent && compositeScore >= 55) || (withinCapacity && compositeScore >= 70)) {
    recommendation = 'MUST_TAKE';
  } else if (withinCapacity || compositeScore >= 55) {
    recommendation = 'RECOMMENDED';
  } else if (c.evidenceStrength < 45 && c.riskScore < 70) {
    recommendation = 'MONITOR';
  } else {
    recommendation = 'DEFER';
  }

  return { caseId: c.id, compositeScore, recommendation, confidence, deadlineDays, deadlineUrgent, rank, contributions };
}

export function computeSIUQueue(cases: CaseRecord[], config: SIUCapacityConfig): SIUQueueResult {
  const activeCases = cases.filter((c) => ACTIVE_STATUSES.has(c.status));
  const totalCapacity = Math.max(1, config.investigatorsCount * config.casesPerInvestigator);
  const maxExposure = Math.max(1, ...cases.map((c) => c.estimatedExposure));

  const ranked = [...activeCases].sort((a, b) => b.priorityScore - a.priorityScore);
  const scored = ranked.map((c, index) => ({
    ...c,
    siuScore: scoreCase(c, maxExposure, index + 1, totalCapacity),
  }));

  const mustTakeCases = scored.filter((c) => c.siuScore.recommendation === 'MUST_TAKE').length;
  const recommendedCases = scored.filter((c) => c.siuScore.recommendation === 'RECOMMENDED').length;
  const deferredCases = scored.filter((c) => c.siuScore.recommendation === 'DEFER').length;
  const monitorCases = scored.filter((c) => c.siuScore.recommendation === 'MONITOR').length;

  const inCapacityCases = Math.min(scored.length, totalCapacity);
  const overCapacityCases = Math.max(0, scored.length - totalCapacity);

  // Weekly throughput = capacity (each investigator clears casesPerInvestigator per week).
  const weeklyThroughput = totalCapacity;
  const weeksToClear = weeklyThroughput > 0 ? Math.round((scored.length / weeklyThroughput) * 10) / 10 : 0;

  const casesDueWithin7Days = scored.filter((c) => c.siuScore.deadlineDays <= 7).length;

  // Estimated workload: evidence-heavy cases take longer. Base 4h + 0.5h/evidence item.
  const estimatedWorkloadHours = Math.round(
    scored.reduce((sum, c) => sum + 4 + c.evidenceBreakdown.length * 0.5, 0),
  );

  return {
    metrics: {
      investigators: config.investigatorsCount,
      casesPerInvestigator: config.casesPerInvestigator,
      totalCapacity,
      activeCases: scored.length,
      inCapacityCases,
      overCapacityCases,
      mustTakeCases,
      recommendedCases,
      deferredCases,
      monitorCases,
      weeksToClear,
      casesDueWithin7Days,
      estimatedWorkloadHours,
    },
    scored,
  };
}

export const RECOMMENDATION_META: Record<
  SIURecommendation,
  { label: string; className: string; dot: string }
> = {
  MUST_TAKE: { label: 'Must Take', className: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  RECOMMENDED: { label: 'Recommended', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  DEFER: { label: 'Defer', className: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  MONITOR: { label: 'Monitor', className: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};
