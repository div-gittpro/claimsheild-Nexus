import { LLMService } from './LLMService';
import {
  InvestigationEvidencePackage,
  StructuredInvestigationBrief,
  RiskExplanation,
  TwinExplanation,
  InvestigatorChatResponse,
} from './types';

export class GroqLLMService implements LLMService {
  private static instance: GroqLLMService;

  public static getInstance(): GroqLLMService {
    if (!GroqLLMService.instance) {
      GroqLLMService.instance = new GroqLLMService();
    }
    return GroqLLMService.instance;
  }

  async generateInvestigationBrief(
    evidence: InvestigationEvidencePackage
  ): Promise<StructuredInvestigationBrief> {
    try {
      const res = await fetch('/api/ai/investigation-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.brief) {
          return data.brief;
        }
      }
    } catch (e) {
      console.warn('Network call to /api/ai/investigation-brief failed, utilizing verified fallback:', e);
    }

    // Deterministic fallback derived ENTIRELY from the supplied evidence package.
    // No fabricated names, IDs, amounts, procedures or statistics (Section 47).
    const detectorTypes = Array.from(new Set(evidence.claimSignals.map((s) => s.type.replace(/_/g, ' '))));
    const topSignal = [...evidence.claimSignals].sort((a, b) => b.count - a.count)[0];
    const normalizeConfidence = (v: number) => (v <= 1 ? Math.round(v * 100) : Math.round(v));
    return {
      executiveSummary: `Case ${evidence.case.caseId} targets ${evidence.provider.name} (${evidence.provider.providerId})${evidence.provider.specialty ? `, ${evidence.provider.specialty}` : ''}. Composite risk is ${evidence.provider.riskScore}/100 with ${evidence.financial.currentExposure.toLocaleString()} dollars in suspicious exposure across ${evidence.claimSignals.length} signal(s) spanning detector type(s): ${detectorTypes.join(', ') || 'none'}. Peer deviation factor is ${evidence.provider.peerDeviationFactor}x.`,
      riskInterpretation: `This classification reflects statistical deviations from peer distributions, not a determination of wrongdoing. It warrants human review of clinical and billing records.${topSignal ? ` The strongest signal is ${topSignal.type.replace(/_/g, ' ')} across ${topSignal.count} claim(s).` : ''}`,
      keyEvidence: evidence.claimSignals.map((sig) => ({
        evidenceId: sig.evidenceId,
        finding: `${sig.type.replace(/_/g, ' ').toUpperCase()}: ${sig.detail}`,
        significance: `Observed across ${sig.count} claim(s)${sig.citations.length ? ` [${sig.citations.slice(0, 3).join(', ')}]` : ''}`,
      })),
      timeline: evidence.timeline.map((t) => ({
        date: t.date,
        event: `Risk ${t.risk}/100. ${t.note}`,
        evidenceId: evidence.claimSignals[0]?.evidenceId,
      })),
      networkContext: evidence.networkSignals.map((n) => ({
        finding: `${n.type}: observed value ${n.value}${n.relatedEntityId ? ` within cluster ${n.relatedEntityId}` : ''}. Relationship concentration is a review signal, not proof.`,
        evidenceId: n.evidenceId,
      })),
      financialImpact: `Suspicious claims under review total ${evidence.financial.currentExposure.toLocaleString()} dollars. The modeled 90-day projection is approximately ${evidence.financial.projected90dExposure.toLocaleString()} dollars absent intervention. Projections are not guaranteed.`,
      memberImpact: `Assessed at ${evidence.memberImpact.severity} impact tier (${evidence.memberImpact.impactScore}/100), associated with ${evidence.memberImpact.affectedCount} member(s). Member identifiers are synthetic.`,
      futureRisk: [
        { horizon: '30D', interpretation: `30-day projected risk level is ${normalizeConfidence(evidence.forecast.horizon30d)}.` },
        { horizon: '60D', interpretation: `60-day projected risk level is ${normalizeConfidence(evidence.forecast.horizon60d)}.` },
        { horizon: '90D', interpretation: `90-day projected risk level is ${normalizeConfidence(evidence.forecast.horizon90d)}.` },
      ],
      recommendedActions: evidence.claimSignals.length > 0
        ? evidence.claimSignals.map((sig) => ({
            action: `Human review: audit ${sig.count} supporting claim(s) for ${sig.type.replace(/_/g, ' ')}.`,
            evidenceIds: [sig.evidenceId],
          }))
        : [{ action: 'Gather additional documentation before any disposition.', evidenceIds: [] }],
      limitations: [
        'Risk scores reflect statistical deviations from peer cohorts and do not constitute legal proof of fraud.',
        'Network association identifies relational exposure for review and does not establish misconduct.',
        'Independent human investigator review is required prior to any payment denial or sanction.',
      ],
      confidenceStatement: `Forecast confidence is ${normalizeConfidence(evidence.forecast.confidence)}%, derived from the verified evidence package.`,
      generatedAt: new Date().toISOString(),
      modelVersion: 'Verified evidence engine (deterministic fallback)',
      isAiGenerated: false,
    };
  }

  async answerInvestigatorQuestion(
    context: {
      caseId?: string;
      providerId?: string;
      networkId?: string;
      currentRisk?: number;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    },
    question: string
  ): Promise<InvestigatorChatResponse> {
    try {
      const res = await fetch('/api/ai/investigator-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, question }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          return data.response;
        }
      }
    } catch (e) {
      console.warn('Network call to /api/ai/investigator-chat failed, using client reasoning:', e);
    }

    return {
      answer: 'No AI response is available. Configure the server AI provider or try again when the service is available.',
      citedEvidenceIds: [],
      suggestedFollowUps: [],
    };
  }

  async explainRisk(
    context: {
      caseId: string;
      providerName: string;
      riskScore: number;
      evidenceBreakdown: any[];
      financialExposure: number;
      memberImpactScore: number;
    }
  ): Promise<RiskExplanation> {
    try {
      const res = await fetch('/api/ai/explain-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.explanation) return data.explanation;
      }
    } catch (e) {
      console.warn('Network call to /api/ai/explain-risk failed, using verified fallback:', e);
    }

    const drivers = (context.evidenceBreakdown || []).map((e: any) => ({
      title: `${String(e.title || e.ruleName || 'Signal').replace(/_/g, ' ')} (+${e.contributionScore ?? 0} pts)`,
      description: e.observedFact || e.description || 'Detector signal computed from submitted claims.',
      evidenceId: e.id,
    }));
    return {
      summary: `Case ${context.caseId} for ${context.providerName} was prioritized at risk ${context.riskScore}/100 because ${drivers.length} independent signal(s) converge, with ${context.financialExposure.toLocaleString()} dollars in exposure and a member impact score of ${context.memberImpactScore}/100.`,
      primaryDrivers: drivers.length > 0 ? drivers : [{
        title: 'Composite risk',
        description: 'Risk is computed from available detector evidence and provider behavior.',
      }],
      investigatorGuidance: 'These indicators support targeted record requests and field verification but do not independently establish fraud. Human review is required.',
    };
  }

  async explainTwinChange(
    context: {
      providerName: string;
      providerId: string;
      riskDelta: number;
      timeline: any[];
      whyNowDeltas: any;
    }
  ): Promise<TwinExplanation> {
    try {
      const res = await fetch('/api/ai/explain-twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.explanation) return data.explanation;
      }
    } catch (e) {
      console.warn('Network call to /api/ai/explain-twin failed, using verified fallback:', e);
    }

    const timeline: any[] = Array.isArray(context.timeline) ? context.timeline : [];
    const deltas = context.whyNowDeltas || {};
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const trajectory = timeline.map((t) => `${t.risk} (${t.date})`).join(' → ');
    const majorChanges: string[] = [];
    if (deltas.claimVelocityChange !== undefined) majorChanges.push(`Claim velocity changed ${deltas.claimVelocityChange >= 0 ? '+' : ''}${deltas.claimVelocityChange}% over the last period.`);
    if (deltas.highValueClaimSpike !== undefined) majorChanges.push(`High-value claim indicator changed ${deltas.highValueClaimSpike >= 0 ? '+' : ''}${deltas.highValueClaimSpike}.`);
    if (deltas.referralDensityChange !== undefined) majorChanges.push(`Referral concentration changed ${deltas.referralDensityChange >= 0 ? '+' : ''}${Math.round(deltas.referralDensityChange)}%.`);
    if (deltas.networkEntitiesAdded !== undefined) majorChanges.push(`Connected network entities: ${deltas.networkEntitiesAdded}.`);
    if (majorChanges.length === 0) majorChanges.push('Insufficient historical detail to enumerate specific changes.');
    return {
      stateSummary: `The behavioral digital twin for ${context.providerName} (${context.providerId}) shows a risk change of ${context.riskDelta >= 0 ? '+' : ''}${context.riskDelta} points${first && last ? ` from ${first.risk} (${first.date}) to ${last.risk} (${last.date})` : ''}.`,
      majorChanges,
      riskTrajectory: trajectory ? `Observed trajectory: ${trajectory}. Forecasts are projections, not certainties.` : 'Insufficient history to establish a trajectory.',
      networkChanges: deltas.networkEntitiesAdded !== undefined ? `Observed ${deltas.networkEntitiesAdded} connected network entities. Network association is a review signal, not proof.` : 'No significant network change observed.',
      potentialImplications: `Without intervention the observed trajectory may continue. A simulated review scenario can be modeled in the Forecast tab. These are projections, not guarantees.`,
      limitations: `Twin projections reflect modeling of observed billing rates and do not guarantee future claim volume or establish provider intent.`,
    };
  }
}

export const llmService: LLMService = GroqLLMService.getInstance();
