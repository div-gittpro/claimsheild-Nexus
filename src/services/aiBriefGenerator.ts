import { CaseRecord, InvestigationBrief } from '../types';

/**
 * Generates a structured investigation brief for a case.
 *
 * The server endpoint proxies to the configured LLM with the server-side key.
 * When the server is unavailable, a deterministic, evidence-grounded fallback is
 * produced ENTIRELY from the canonical CaseRecord — no fabricated names, IDs,
 * amounts, procedures, or statistics (Section 47).
 */
export async function generateInvestigationBrief(c: CaseRecord): Promise<InvestigationBrief> {
  try {
    const res = await fetch(`/api/cases/${c.id}/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseData: c }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.brief) return data.brief;
    }
  } catch {
    // fall through to deterministic brief
  }

  const evidenceIds = c.evidenceBreakdown.map((e) => e.id);
  const detectorTypes = Array.from(new Set(c.evidenceBreakdown.map((e) => e.ruleName.replace(/_/g, ' '))));
  const projected90d = c.forecast90d > 0 ? c.estimatedExposure + (c.estimatedExposure * (c.forecast90d - c.riskScore)) / Math.max(c.riskScore, 1) : c.estimatedExposure;

  return {
    generatedAt: new Date().toISOString(),
    caseId: c.id,
    providerId: c.targetId,
    providerName: c.targetName,
    modelUsed: 'Verified evidence engine (deterministic fallback)',
    executiveSummary: `Case ${c.id} targets ${c.targetName} (${c.targetId})${c.specialty ? `, ${c.specialty}` : ''}. The entity has a computed composite risk score of ${c.riskScore}/100 with ${c.estimatedExposure.toLocaleString()} dollars in suspicious exposure across ${c.evidenceBreakdown.length} evidence signals spanning ${detectorTypes.length} detector type(s): ${detectorTypes.join(', ') || 'none'}.`,
    whyFlagged: c.evidenceBreakdown.length > 0
      ? c.evidenceBreakdown.map((e) => `${e.ruleName.replace(/_/g, ' ')}: ${e.observedFact} [Evidence: ${e.id}]`)
      : ['No independent detector evidence was generated for this entity.'],
    keyEvidence: c.evidenceBreakdown.map((e) => ({
      evidenceId: e.id,
      finding: `${e.title.replace(/_/g, ' ')}: ${e.observedFact}`,
      citations: e.supportingRecordIds,
    })),
    timelineSummary: `Computed risk is ${c.riskScore}/100. Evidence strength is ${c.evidenceStrength}% derived from ${c.evidenceBreakdown.length} detector signals. Member impact is assessed at the ${c.memberImpactTier} tier (${c.memberImpactScore}/100).`,
    networkContext: c.networkId
      ? `Entity participates in connected cluster ${c.networkName || c.networkId} with a computed network risk of ${c.networkRiskScore}/100. Relationship concentration is a review signal and does not establish wrongdoing.`
      : 'No connected provider cluster was detected for this entity.',
    financialImpactAnalysis: `Suspicious claim volume accounts for ${c.estimatedExposure.toLocaleString()} dollars in exposure. Under the observed trajectory, the 90-day projection is approximately ${Math.round(projected90d).toLocaleString()} dollars absent intervention. Projections are not guaranteed.`,
    memberImpactAnalysis: `${c.affectedMembersCount} member(s) are associated with flagged claims (${c.memberImpactTier} impact tier, score ${c.memberImpactScore}/100). ${c.potentialUnnecessaryProcedures} potentially avoidable procedure instance(s) were observed. Member identifiers are synthetic.`,
    predictiveRiskTrajectory: c.forecast30d > 0
      ? `Forecast: 30-day ${c.forecast30d}, 60-day ${c.forecast60d}, 90-day ${c.forecast90d} (confidence ${c.forecastConfidence}%). Forecast is a projection, not a certainty.`
      : 'Insufficient history to produce a reliable forecast.',
    recommendedInvestigatorActions: c.evidenceBreakdown.length > 0
      ? c.evidenceBreakdown.map((e) => `Human review: audit ${e.supportingRecordIds.length} supporting claim(s) for ${e.ruleName.replace(/_/g, ' ')} [${e.id}].`)
      : ['Gather additional documentation before any disposition.'],
    limitationsAndUncertainty: `Risk scores and detector signals reflect statistical deviations from peer distributions and do not constitute legal proof or a determination of fraud. Human SIU investigator review and documentation validation are required prior to any adverse administrative action. Supporting evidence: ${evidenceIds.join(', ') || 'none'}.`,
    isAiGenerated: false,
  };
}
