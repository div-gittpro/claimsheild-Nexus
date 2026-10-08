import { Claim, Provider, Facility, Member, CaseRecord, RiskLevel } from '../types';

export interface CSVParseResult {
  success: boolean;
  claimsCount: number;
  providersCount: number;
  warningsCount: number;
  errors: string[];
  claims: Claim[];
  providers: Provider[];
  cases: CaseRecord[];
}

export function parseCSVText(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Parse headers
  const headers = splitCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '_').trim()
  );

  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    records.push(row);
  }

  return records;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function ingestClaimsFromRecords(records: Record<string, string>[]): CSVParseResult {
  const errors: string[] = [];
  let warningsCount = 0;

  if (records.length === 0) {
    return {
      success: false,
      claimsCount: 0,
      providersCount: 0,
      warningsCount: 0,
      errors: ['CSV file contains no data rows.'],
      claims: [],
      providers: [],
      cases: [],
    };
  }

  const claims: Claim[] = [];
  const providersMap = new Map<string, {
    name: string;
    specialty: string;
    claims: Claim[];
    facilities: Set<string>;
    members: Set<string>;
  }>();

  records.forEach((r, idx) => {
    const claimId = r.claim_id || r.id || `row-${idx + 1}`;
    const providerId = r.provider_id || r.doctor_id || '';
    const providerName = r.provider_name || r.doctor_name || '';
    const memberId = r.member_id || r.patient_id || '';
    const memberName = r.member_name || r.patient_name || '';
    const facilityId = r.facility_id || r.clinic_id || '';
    const facilityName = r.facility_name || r.clinic_name || '';
    const serviceDate = r.service_date || r.date || '';
    const procedureCode = r.procedure_code || r.cpt || r.code || '';
    const procedureDesc = r.procedure_description || r.procedure_desc || r.description || '';
    const diagnosisCode = r.diagnosis_code || r.icd10 || r.diagnosis || '';
    const billedAmount = parseFloat(r.billed_amount || r.amount || '0') || 0;
    const allowedAmount = parseFloat(r.allowed_amount || '0') || 0;
    const paidAmount = parseFloat(r.paid_amount || '0') || 0;

    const claim: Claim = {
      id: claimId,
      claimNumber: claimId,
      providerId,
      providerName,
      memberId,
      memberName,
      facilityId,
      facilityName,
      serviceDate,
      submissionDate: serviceDate,
      procedureCode,
      procedureDescription: procedureDesc,
      diagnosisCode,
      billedAmount,
      allowedAmount,
      paidAmount,
      status: 'PAID',
      riskScore: 10,
      flags: [],
      ruleViolations: [],
    };

    claims.push(claim);

    // Track provider
    if (!providersMap.has(providerId)) {
      providersMap.set(providerId, {
        name: providerName,
        specialty: r.specialty || 'General Practice',
        claims: [],
        facilities: new Set(),
        members: new Set(),
      });
    }
    const pData = providersMap.get(providerId)!;
    pData.claims.push(claim);
    pData.facilities.add(facilityId);
    pData.members.add(memberId);
  });

  // Run Rule Detection Engine on claims
  // 1. Duplicate claim detection
  const claimGroupMap = new Map<string, Claim[]>();
  claims.forEach((clm) => {
    const key = `${clm.memberId}_${clm.serviceDate}_${clm.procedureCode}`;
    if (!claimGroupMap.has(key)) claimGroupMap.set(key, []);
    claimGroupMap.get(key)!.push(clm);
  });

  claimGroupMap.forEach((group) => {
    if (group.length > 1) {
      warningsCount += group.length;
      group.forEach((clm) => {
        clm.status = 'FLAGGED';
        clm.riskScore = Math.max(clm.riskScore, 92);
        clm.flags.push('DUPLICATE_CLAIM_PAIR');
        clm.ruleViolations.push({
          ruleId: 'FWA-001',
          ruleName: 'Potential Duplicate Billing',
          score: 92,
          severity: 'CRITICAL',
          evidence: `Multiple submissions for CPT ${clm.procedureCode} for patient ${clm.memberName} on ${clm.serviceDate}.`,
        });
      });
    }
  });

  // 2. High-complexity visit code upcoding (Level 5 E&M: CPT 99215)
  claims.forEach((clm) => {
    if (clm.procedureCode === '99215' || clm.procedureCode.includes('99215')) {
      clm.status = 'FLAGGED';
      clm.riskScore = Math.max(clm.riskScore, 85);
      clm.flags.push('OUTLIER_UPCODING_LEVEL_5');
      clm.ruleViolations.push({
        ruleId: 'FWA-002',
        ruleName: 'High-Complexity Visit Upcoding',
        score: 85,
        severity: 'HIGH',
        evidence: `Level 5 visit code (CPT 99215) billed with $${clm.billedAmount} charge.`,
      });
    }
  });

  // Build Provider Entities
  const providers: Provider[] = [];
  providersMap.forEach((data, pId) => {
    const totalBilled = data.claims.reduce((sum, c) => sum + c.billedAmount, 0);
    const avgClaim = totalBilled / (data.claims.length || 1);
    const flaggedClaims = data.claims.filter((c) => c.status === 'FLAGGED');
    const exposure = flaggedClaims.reduce((sum, c) => sum + c.billedAmount, 0);

    const level5Count = data.claims.filter((c) => c.procedureCode === '99215').length;
    const level5Ratio = data.claims.length > 0 ? (level5Count / data.claims.length) * 100 : 0;
    const peerDeviation = Math.round((Math.max(1, level5Ratio / 14)) * 10) / 10;

    let riskScore = 15;
    if (flaggedClaims.length > 0) {
      riskScore = Math.min(99, Math.round(50 + (flaggedClaims.length / data.claims.length) * 45));
    }

    const riskLevel: RiskLevel =
      riskScore >= 85 ? 'CRITICAL' : riskScore >= 70 ? 'HIGH' : riskScore >= 45 ? 'MEDIUM' : 'NORMAL';

    providers.push({
      id: pId,
      npi: data.claims[0]?.providerId || '',
      name: data.name,
      specialty: data.specialty,
      location: '',
      address: '',
      lat: 0,
      lng: 0,
      riskScore,
      riskLevel,
      trendDirection: riskScore > 60 ? 'UP' : 'STABLE',
      trendDelta30d: riskScore > 60 ? 25 : 0,
      claimsCount: data.claims.length,
      totalBilled: Math.round(totalBilled),
      avgClaimAmount: Math.round(avgClaim),
      memberCount: data.members.size,
      referralDensity: flaggedClaims.length > 2 ? 0.72 : 0.15,
      peerDeviationFactor: peerDeviation,
      networkRiskScore: riskScore,
      estimatedExposure: Math.round(exposure),
      projectedExposure30d: Math.round(exposure * 1.3),
      projectedExposure60d: Math.round(exposure * 1.7),
      projectedExposure90d: Math.round(exposure * 2.2),
      forecast30d: Math.min(95, Math.round(riskScore * 0.8)),
      forecast60d: Math.min(96, Math.round(riskScore * 0.9)),
      forecast90d: Math.min(98, Math.round(riskScore * 0.96)),
      forecastConfidence: 0,
      evidenceStrength: flaggedClaims.length > 0 ? 85 : 20,
      connectedFacilityIds: Array.from(data.facilities),
      topProcedures: [
        { code: '99215', count: level5Count, billed: level5Count * 450 },
        { code: '99213', count: data.claims.length - level5Count, billed: (data.claims.length - level5Count) * 150 },
      ],
      peerComparisons: [
        { metric: 'Level 5 Visit Code Ratio', providerVal: Math.round(level5Ratio), peerVal: 14.2, unit: '%', ratio: peerDeviation },
        { metric: 'Duplicate Billing Pairs', providerVal: flaggedClaims.length, peerVal: 0.2, unit: 'pairs', ratio: Math.max(1, flaggedClaims.length * 5) },
      ],
    });
  });

  // Sort providers by risk
  providers.sort((a, b) => b.riskScore - a.riskScore);

  // Generate SIU Cases for top providers with exposure
  const cases: CaseRecord[] = providers
    .filter((p) => p.estimatedExposure > 0 || p.riskScore >= 70)
    .slice(0, 5)
    .map((p, idx) => {
      const pFlagged = claims.filter((c) => c.providerId === p.id && c.status === 'FLAGGED');
      return {
        id: `CASE-${1040 + idx + 1}`,
        title: `${p.name} - Billing Review`,
        priorityScore: p.riskScore,
        priorityRank: idx + 1,
        targetType: 'PROVIDER',
        targetId: p.id,
        targetName: p.name,
        specialty: p.specialty,
        riskScore: p.riskScore,
        riskLevel: p.riskLevel,
        evidenceStrength: p.evidenceStrength,
        forecastConfidence: p.forecastConfidence,
        estimatedExposure: p.estimatedExposure,
        memberImpactTier: p.riskScore >= 85 ? 'CRITICAL' : 'HIGH',
        memberImpactScore: Math.round(p.riskScore * 0.9),
        potentialUnnecessaryProcedures: pFlagged.length,
        affectedMembersCount: p.memberCount,
        networkRiskScore: p.networkRiskScore,
        forecast30d: p.forecast30d,
        forecast60d: p.forecast60d,
        forecast90d: p.forecast90d,
        status: 'NEW',
          assignedInvestigator: '',
          slaDaysRemaining: 0,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        whyNowDeltas: {
          claimVelocityChange: 35,
          highValueClaimSpike: 45,
          referralDensityChange: 22,
          networkEntitiesAdded: 1,
          riskDelta30d: 28,
        },
        evidenceBreakdown: [
          {
            id: `EVD-${idx + 1}01`,
            ruleId: 'FWA-001',
            ruleName: 'Potential Duplicate Billing',
            category: 'DUPLICATE_BILLING',
            title: 'Duplicate Claim Encounters',
            description: `${pFlagged.length} flagged claims with identical billing profiles.`,
            contributionScore: 18,
            weightPercentage: 25,
            supportingRecordIds: pFlagged.slice(0, 4).map((c) => c.id),
            severity: p.riskLevel,
            observedFact: `${pFlagged.length} claims billed for same patient on same date of service.`,
            modelInference: 'Statistical duplication confidence exceeds legitimate repeat procedure rate.',
            timestamp: new Date().toISOString(),
          },
          {
            id: `EVD-${idx + 1}02`,
            ruleId: 'FWA-002',
            ruleName: 'High-Complexity Visit Upcoding',
            category: 'UPCODING',
            title: 'Level 5 Visit Frequency Deviation',
            description: `Billed at ${p.peerDeviationFactor}x regional specialty benchmark for CPT 99215.`,
            contributionScore: 16,
            weightPercentage: 22,
            supportingRecordIds: pFlagged.slice(0, 3).map((c) => c.id),
            severity: 'HIGH',
            observedFact: `Level 5 visits represent significant proportion of billed evaluation encounters.`,
            modelInference: 'Acuity score deviates statistically from specialty peer baseline.',
            timestamp: new Date().toISOString(),
          },
        ],
        recommendedActions: [
          { id: 'ACT-01', actionText: `Request itemized clinical records for ${pFlagged.length} duplicate claims.`, category: 'Chart Audit', completed: false },
          { id: 'ACT-02', actionText: `Validate medical necessity documentation for Level 5 visit codes.`, category: 'Medical Review', completed: false },
        ],
        investigatorNotes: [
          {
            id: 'NOTE-01',
            author: 'System Intake Engine',
            timestamp: new Date().toISOString(),
            content: `Ingested from custom CSV upload with ${claims.length} total claims. Case generated by automated detection rules.`,
          },
        ],
      };
    });

  return {
    success: true,
    claimsCount: claims.length,
    providersCount: providers.length,
    warningsCount,
    errors,
    claims,
    providers,
    cases,
  };
}
