import {
  CaseRecord,
  Claim,
  DigitalTwinTimelinePoint,
  Facility,
  GraphEdge,
  GraphNode,
  Member,
  NetworkCluster,
  Provider,
  RiskLevel,
  EvidenceItem,
  AnalysisRun,
} from '../types';
import { evaluateSIUEligibility } from './siuEligibilityService';

export interface ClaimSubmittedEvent {
  analysisRunId: string;
  eventId: string;
  eventType: 'ClaimSubmitted';
  aggregateType: 'Claim';
  aggregateId: string;
  timestamp: string;
  payload: {
    claimId: string;
    providerId: string;
    memberId: string;
    facilityId: string;
    procedureCode: string;
    procedureName: string;
    amount: number;
    serviceDate: string;
    serviceTimestamp: string;
    location: string;
    latitude: number;
    longitude: number;
  };
}

export interface EvidenceRecord {
  analysisRunId?: string;
  evidenceId: string;
  entityType: string;
  entityId: string;
  type: string;
  severity: number;
  confidence: number;
  source: string;
  claimIds: string[];
  createdAt: string;
  ruleVersion: string;
  details: Record<string, unknown>;
}

export interface AnalysisSnapshot {
  analysisRunId: string;
  analysisRun: AnalysisRun;
  claims: Claim[];
  providers: Provider[];
  members: Member[];
  facilities: Facility[];
  networks: NetworkCluster[];
  cases: CaseRecord[];
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] };
  timelinePoints: DigitalTwinTimelinePoint[];
  events: ClaimSubmittedEvent[];
  evidence: EvidenceRecord[];
  rejectedRows: number;
  warnings: number;
  integrityErrors: string[];
}

const now = () => new Date().toISOString();
const numberValue = (value: string | undefined) => {
  const parsed = Number((value || '').replace(/[$,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};
const first = (row: Record<string, string>, keys: string[]) => keys.map((key) => row[key]).find((value) => value !== undefined && value.trim() !== '') || '';
const riskLevel = (score: number): RiskLevel => score >= 85 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : score >= 20 ? 'LOW' : 'NORMAL';
const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};
const dateMs = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
};
const eventIdFor = (claimId: string) => `evt_${claimId}`;

export function analyzeClaims(records: Record<string, string>[], processedEventIds = new Set<string>(), analysisRunId = 'RUN-UNSCOPED', datasetName = 'Uploaded dataset'): AnalysisSnapshot {
  const rejected = records.filter((row) => !first(row, ['claim_id', 'id'])).length;
  const validRows = records.filter((row) => first(row, ['claim_id', 'id']));
  const claims: Claim[] = [];
  const events: ClaimSubmittedEvent[] = [];
  const evidence: EvidenceRecord[] = [];
  const claimEvidence = new Map<string, EvidenceRecord[]>();
  const providerRows = new Map<string, { claims: Claim[]; name: string; specialty: string; facilities: Set<string>; members: Set<string> }>();
  const memberRows = new Map<string, { claims: Claim[]; name: string }>();
  const facilityRows = new Map<string, { claims: Claim[]; name: string; location: string; lat: number; lng: number; providers: Set<string> }>();

  const addEvidence = (record: EvidenceRecord) => {
    evidence.push(record);
    const list = claimEvidence.get(record.entityId) || [];
    list.push(record);
    claimEvidence.set(record.entityId, list);
  };

  validRows.forEach((row) => {
    const claimId = first(row, ['claim_id', 'id']);
    const providerId = first(row, ['provider_id', 'doctor_id']);
    const memberId = first(row, ['member_id', 'patient_id']);
    const facilityId = first(row, ['facility_id', 'clinic_id']);
    const serviceDate = first(row, ['service_date', 'date']);
    const procedureCode = first(row, ['procedure_code', 'cpt', 'code']);
    const providerName = first(row, ['provider_name', 'doctor_name']);
    const memberName = first(row, ['member_name', 'patient_name']);
    const facilityName = first(row, ['facility_name', 'clinic_name']);
    const procedureDescription = first(row, ['procedure_description', 'procedure_desc', 'procedure_name', 'description']);
    const diagnosisCode = first(row, ['diagnosis_code', 'icd10', 'diagnosis']);
    const amount = numberValue(first(row, ['billed_amount', 'amount', 'total_amount']));
    const allowedAmount = numberValue(first(row, ['allowed_amount']));
    const paidAmount = numberValue(first(row, ['paid_amount'])) || allowedAmount;
    const location = first(row, ['location', 'city', 'facility_location']);
    const latitude = numberValue(first(row, ['latitude', 'lat']));
    const longitude = numberValue(first(row, ['longitude', 'lng', 'lon']));
    const serviceTimestamp = first(row, ['service_timestamp', 'timestamp', 'service_datetime']) || `${serviceDate}T${first(row, ['service_time', 'time']) || '00:00:00'}`;
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
      submissionDate: first(row, ['submission_date', 'submitted_at']) || serviceDate,
      procedureCode,
      procedureDescription,
      diagnosisCode,
      billedAmount: amount,
      allowedAmount,
      paidAmount,
      status: 'PAID',
      riskScore: 0,
      flags: [],
      ruleViolations: [],
    };
    claims.push(claim);
    const provider = providerRows.get(providerId) || { claims: [], name: providerName, specialty: first(row, ['specialty']), facilities: new Set<string>(), members: new Set<string>() };
    provider.claims.push(claim);
    provider.facilities.add(facilityId);
    provider.members.add(memberId);
    providerRows.set(providerId, provider);
    const member = memberRows.get(memberId) || { claims: [], name: memberName };
    member.claims.push(claim);
    memberRows.set(memberId, member);
    const facility = facilityRows.get(facilityId) || { claims: [], name: facilityName, location, lat: latitude, lng: longitude, providers: new Set<string>() };
    facility.claims.push(claim);
    facility.providers.add(providerId);
    facilityRows.set(facilityId, facility);
    const eventId = eventIdFor(claimId);
    if (!processedEventIds.has(eventId)) {
      events.push({ analysisRunId, eventId, eventType: 'ClaimSubmitted', aggregateType: 'Claim', aggregateId: claimId, timestamp: now(), payload: { claimId, providerId, memberId, facilityId, procedureCode, procedureName: procedureDescription, amount, serviceDate, serviceTimestamp, location, latitude, longitude } });
      processedEventIds.add(eventId);
    }
  });

  const duplicateGroups = new Map<string, Claim[]>();
  claims.forEach((claim) => {
    const key = `${claim.providerId}|${claim.memberId}|${claim.procedureCode}|${claim.serviceDate}`;
    const group = duplicateGroups.get(key) || [];
    group.push(claim);
    duplicateGroups.set(key, group);
  });
  duplicateGroups.forEach((group) => {
    if (group.length < 2) return;
    const claimIds = group.map((claim) => claim.id);
    group.forEach((claim) => {
      claim.status = 'FLAGGED';
      claim.flags.push('DUPLICATE_BILLING');
      claim.riskScore = Math.max(claim.riskScore, 65);
      claim.ruleViolations.push({ ruleId: 'DUPLICATE_BILLING', ruleName: 'Duplicate Billing', score: 65, severity: 'HIGH', evidence: `Matching provider, member, procedure, date and amount group: ${claimIds.join(', ')}` });
      addEvidence({ evidenceId: `EVD-DUP-${claim.id}`, entityType: 'PROVIDER', entityId: claim.providerId, type: 'DUPLICATE_BILLING', severity: 75, confidence: 95, source: 'DuplicateBillingRule', claimIds, createdAt: now(), ruleVersion: 'duplicate-v1', details: { providerId: claim.providerId, memberId: claim.memberId, procedureCode: claim.procedureCode, serviceDate: claim.serviceDate } });
    });
  });

  const providers: Provider[] = [];
  providerRows.forEach((data, providerId) => {
    const emClaims = data.claims.filter((claim) => /^99(2(1[1-5])|4[1-5])$/.test(claim.procedureCode));
    const highComplexity = data.claims.filter((claim) => ['99214', '99215'].includes(claim.procedureCode));
    if (highComplexity.length >= 3 && highComplexity.length / Math.max(emClaims.length, 1) > 0.5) {
      const ids = highComplexity.map((claim) => claim.id);
      highComplexity.forEach((claim) => { claim.status = 'FLAGGED'; claim.flags.push('UPCODING_PATTERN'); claim.riskScore = Math.max(claim.riskScore, 55); });
      addEvidence({ evidenceId: `EVD-UP-${providerId}`, entityType: 'PROVIDER', entityId: providerId, type: 'UPCODING_PATTERN', severity: 60, confidence: Math.min(95, 55 + highComplexity.length), source: 'ComplexityDistributionRule', claimIds: ids, createdAt: now(), ruleVersion: 'upcoding-v1', details: { highComplexityCount: highComplexity.length, evaluationCount: emClaims.length, highComplexityRatio: highComplexity.length / Math.max(emClaims.length, 1) } });
    }
  });

  const bundleCodes = new Set(['80053', '93000', '71046']);
  const bundleGroups = new Map<string, Claim[]>();
  claims.forEach((claim) => {
    if (!bundleCodes.has(claim.procedureCode)) return;
    const key = `${claim.providerId}|${claim.memberId}|${claim.serviceDate}`;
    const group = bundleGroups.get(key) || [];
    group.push(claim);
    bundleGroups.set(key, group);
  });
  bundleGroups.forEach((group) => {
    if (new Set(group.map((claim) => claim.procedureCode)).size < 2) return;
    const ids = group.map((claim) => claim.id);
    group.forEach((claim) => { claim.status = 'FLAGGED'; claim.flags.push('UNBUNDLING_PATTERN'); claim.riskScore = Math.max(claim.riskScore, 55); });
    addEvidence({ evidenceId: `EVD-BUNDLE-${group[0].providerId}-${group[0].serviceDate}`, entityType: 'PROVIDER', entityId: group[0].providerId, type: 'UNBUNDLING_PATTERN', severity: 65, confidence: 80, source: 'ProcedureCombinationRule', claimIds: ids, createdAt: now(), ruleVersion: 'unbundling-v1', details: { procedureCodes: group.map((claim) => claim.procedureCode) } });
  });

  memberRows.forEach((data, memberId) => {
    const byProvider = new Map<string, Claim[]>();
    data.claims.forEach((claim) => byProvider.set(claim.providerId, [...(byProvider.get(claim.providerId) || []), claim]));
    byProvider.forEach((memberClaims, providerId) => {
      if (memberClaims.length < 5) return;
      addEvidence({ evidenceId: `EVD-UTIL-${memberId}-${providerId}`, entityType: 'PROVIDER', entityId: providerId, type: 'EXCESSIVE_UTILIZATION', severity: 55, confidence: Math.min(95, 50 + memberClaims.length), source: 'UtilizationRule', claimIds: memberClaims.map((claim) => claim.id), createdAt: now(), ruleVersion: 'utilization-v1', details: { memberId, serviceCount: memberClaims.length, threshold: 5 } });
      memberClaims.forEach((claim) => { claim.flags.push('EXCESSIVE_UTILIZATION'); claim.riskScore = Math.max(claim.riskScore, 45); });
    });
  });

  const providerTimeline = new Map<string, Claim[]>();
  claims.forEach((claim) => providerTimeline.set(claim.providerId, [...(providerTimeline.get(claim.providerId) || []), claim]));
  providerTimeline.forEach((providerClaims, providerId) => {
    const sorted = [...providerClaims].sort((a, b) => dateMs(a.serviceDate) - dateMs(b.serviceDate));
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const previousRow = validRows.find((row) => first(row, ['claim_id', 'id']) === previous.id) || {};
      const currentRow = validRows.find((row) => first(row, ['claim_id', 'id']) === current.id) || {};
      const previousTime = first(previousRow, ['service_timestamp', 'timestamp', 'service_datetime', 'service_time']);
      const currentTime = first(currentRow, ['service_timestamp', 'timestamp', 'service_datetime', 'service_time']);
      const availableMinutes = previousTime && currentTime ? Math.max(0, (dateMs(currentTime) - dateMs(previousTime)) / 60000) : 0;
      const distance = distanceKm(numberValue(first(previousRow, ['latitude', 'lat'])), numberValue(first(previousRow, ['longitude', 'lng', 'lon'])), numberValue(first(currentRow, ['latitude', 'lat'])), numberValue(first(currentRow, ['longitude', 'lng', 'lon'])));
      const estimatedTravelMinutes = distance > 0 ? distance / 0.8 : 0;
      if (distance >= 20 && availableMinutes > 0 && estimatedTravelMinutes > availableMinutes) {
        previous.temporalOverlap = true;
        current.temporalOverlap = true;
        previous.distanceFromPreviousMiles = distance * 0.621371;
        current.distanceFromPreviousMiles = distance * 0.621371;
        previous.minutesFromPrevious = availableMinutes;
        current.minutesFromPrevious = availableMinutes;
        [previous, current].forEach((claim) => { claim.status = 'FLAGGED'; claim.flags.push('IMPOSSIBLE_TIMING'); claim.riskScore = Math.max(claim.riskScore, 70); });
        addEvidence({ evidenceId: `EVD-TIME-${previous.id}-${current.id}`, entityType: 'PROVIDER', entityId: providerId, type: 'IMPOSSIBLE_TIMING', severity: 85, confidence: 90, source: 'TemporalFeasibilityRule', claimIds: [previous.id, current.id], createdAt: now(), ruleVersion: 'timing-v1', details: { distanceKm: distance, availableMinutes, estimatedTravelMinutes } });
      }
    }
  });

  providerRows.forEach((data, providerId) => {
    const providerEvidence = evidence.filter((item) => item.entityId === providerId);
    const total = data.claims.reduce((sum, claim) => sum + claim.billedAmount, 0);
    const linkedClaimIds = new Set(providerEvidence.flatMap((item) => item.claimIds));
    const linkedClaims = data.claims.filter((claim) => linkedClaimIds.has(claim.id));
    const suspicious = linkedClaims.reduce((sum, claim) => sum + claim.billedAmount, 0);
    const typeCount = new Set(providerEvidence.map((item) => item.type)).size;
    const ruleSeverity = providerEvidence.length ? providerEvidence.reduce((sum, item) => sum + item.severity, 0) / providerEvidence.length : 0;
    const behavior = data.claims.length ? Math.min(100, Math.round((data.claims.filter((claim) => claim.flags.length > 0).length / data.claims.length) * 100)) : 0;
    const evidenceStrength = providerEvidence.length
      ? Math.min(100, Math.round((providerEvidence.reduce((sum, item) => sum + item.severity * (item.confidence / 100), 0) / providerEvidence.length) * 0.75 + Math.min(25, typeCount * 4)))
      : 0;
    const dates = new Set(data.claims.map((claim) => claim.serviceDate));
    const sufficientHistory = dates.size >= 2;
    const exposure = suspicious;
    const forecastBase = Math.min(100, Math.round(ruleSeverity * 0.45 + behavior * 0.35 + Math.min(100, dates.size * 20) * 0.2));
    const forecast30d = sufficientHistory ? Math.min(100, Math.round(forecastBase * (1 + behavior / 300))) : 0;
    const forecast60d = sufficientHistory ? Math.min(100, Math.round(forecastBase * (1 + behavior / 200))) : 0;
    const forecast90d = sufficientHistory ? Math.min(100, Math.round(forecastBase * (1 + behavior / 150))) : 0;
    const procedureTotals = data.claims.reduce((map, claim) => {
      const current = map.get(claim.procedureCode) || { count: 0, billed: 0 };
      map.set(claim.procedureCode, { count: current.count + 1, billed: current.billed + claim.billedAmount });
      return map;
    }, new Map<string, { count: number; billed: number }>());
    const topProcedures = Array.from(procedureTotals.entries()).map(([code, value]) => ({ code, count: value.count, billed: value.billed }));
    const peerHighComplexity = data.claims.filter((claim) => ['99214', '99215'].includes(claim.procedureCode)).length / Math.max(data.claims.length, 1);
    const provider: Provider = {
      id: providerId, npi: first(validRows.find((row) => first(row, ['claim_id', 'id']) === data.claims[0].id) || {}, ['npi']), name: data.name, specialty: data.specialty || 'Unspecified', location: first(validRows.find((row) => first(row, ['claim_id', 'id']) === data.claims[0].id) || {}, ['location', 'city']), address: '', lat: 0, lng: 0,
      riskScore: 0, riskLevel: 'NORMAL', trendDirection: behavior > 0 ? 'UP' : 'STABLE', trendDelta30d: behavior, claimsCount: data.claims.length, totalBilled: Math.round(total), avgClaimAmount: Math.round(total / Math.max(data.claims.length, 1)), memberCount: data.members.size, referralDensity: 0, peerDeviationFactor: Math.round(peerHighComplexity * 100) / 14.2, networkRiskScore: 0, estimatedExposure: Math.round(exposure), totalExposure: Math.round(total), suspiciousExposure: Math.round(exposure), potentiallyAvoidableExposure: Math.round(exposure), projectedExposure30d: sufficientHistory ? Math.round(exposure * (1 + behavior / 100)) : 0, projectedExposure60d: sufficientHistory ? Math.round(exposure * (1 + behavior / 70)) : 0, projectedExposure90d: sufficientHistory ? Math.round(exposure * (1 + behavior / 50)) : 0, forecast30d, forecast60d, forecast90d, forecastConfidence: sufficientHistory ? Math.min(95, 50 + dates.size * 5) : 0, evidenceStrength, peerComparisons: [{ metric: 'High-complexity procedure ratio', providerVal: Math.round(peerHighComplexity * 100), peerVal: 14.2, unit: '%', ratio: Math.round((peerHighComplexity * 100 / 14.2) * 10) / 10 }], connectedFacilityIds: Array.from(data.facilities), topProcedures, isFlagship: false,
    };
    (provider as Provider & { evidenceCount?: number }).evidenceCount = providerEvidence.length;
    (provider as Provider & { evidenceTypes?: string[] }).evidenceTypes = Array.from(new Set(providerEvidence.map((item) => item.type)));
    (provider as Provider & { affectedMembers?: number }).affectedMembers = new Set(data.claims.filter((claim) => claim.flags.length > 0).map((claim) => claim.memberId)).size;
    providers.push(provider);
  });

  const members: Member[] = Array.from(memberRows.entries()).map(([id, data]) => {
    const flagged = data.claims.filter((claim) => claim.flags.length > 0);
    const score = Math.min(100, flagged.length * 15);
    return { id, name: data.name, dob: '', gender: 'OTHER', riskScore: score, totalClaims: data.claims.length, totalPaid: data.claims.reduce((sum, claim) => sum + claim.paidAmount, 0), impactTier: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW', impactFactors: Array.from(new Set(flagged.flatMap((claim) => claim.flags))), assignedProviderId: data.claims[0]?.providerId };
  });
  const facilities: Facility[] = Array.from(facilityRows.entries()).map(([id, data]) => ({ id, name: data.name, facilityType: 'HOSPITAL', location: data.location, address: '', lat: data.lat, lng: data.lng, riskScore: Math.round(data.claims.filter((claim) => claim.flags.length > 0).length / Math.max(data.claims.length, 1) * 100), activeProviders: Array.from(data.providers), claimsProcessed: data.claims.length, totalBilled: data.claims.reduce((sum, claim) => sum + claim.billedAmount, 0), flaggedRate: data.claims.filter((claim) => claim.flags.length > 0).length / Math.max(data.claims.length, 1) }));

  const providerIds = Array.from(providerRows.keys());
  const adjacency = new Map<string, Set<string>>(providerIds.map((id) => [id, new Set<string>()]));
  providerIds.forEach((left, index) => providerIds.slice(index + 1).forEach((right) => {
    const leftData = providerRows.get(left)!;
    const rightData = providerRows.get(right)!;
    const sharedMembers = new Set([...leftData.members].filter((memberId) => rightData.members.has(memberId))).size;
    const sharedFacilities = new Set([...leftData.facilities].filter((facilityId) => rightData.facilities.has(facilityId))).size;
    if (sharedMembers > 0 && sharedFacilities > 0) { adjacency.get(left)!.add(right); adjacency.get(right)!.add(left); }
  }));
  const networks: NetworkCluster[] = [];
  const graphNodes: GraphNode[] = [];
  const graphEdges: GraphEdge[] = [];
  const visited = new Set<string>();
  let networkNumber = 1;
  providerIds.forEach((start) => {
    if (visited.has(start)) return;
    const component: string[] = [];
    const queue = [start];
    visited.add(start);
    while (queue.length) { const current = queue.shift()!; component.push(current); adjacency.get(current)!.forEach((neighbor) => { if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); } }); }
    if (component.length < 2) return;
    const componentClaims = claims.filter((claim) => component.includes(claim.providerId));
    const componentEvidence = evidence.filter((item) => component.includes(item.entityId));
    const sharedMembers = new Set(componentClaims.map((claim) => claim.memberId));
    const sharedFacilities = new Set(componentClaims.map((claim) => claim.facilityId));
    const evidenceDensity = Math.min(100, componentEvidence.length * 10);
    const sharedStructure = Math.min(100, sharedFacilities.size * 25 + sharedMembers.size * 5);
    const networkRisk = Math.round((componentEvidence.length ? componentEvidence.reduce((sum, item) => sum + item.severity, 0) / componentEvidence.length : 0) * 0.5 + evidenceDensity * 0.25 + sharedStructure * 0.25);
    const networkId = `NET-${String(networkNumber).padStart(3, '0')}`;
    networkNumber += 1;
    networks.push({ id: networkId, name: `Connected claims cluster ${networkId}`, riskScore: networkRisk, riskLevel: riskLevel(networkRisk), providerCount: component.length, memberCount: sharedMembers.size, facilityCount: sharedFacilities.size, totalClaimsCount: componentClaims.length, estimatedExposure: componentClaims.filter((claim) => claim.flags.length > 0).reduce((sum, claim) => sum + claim.billedAmount, 0), projectedExposure90d: componentClaims.reduce((sum, claim) => sum + claim.billedAmount, 0), primarySpecialty: providers.find((provider) => provider.id === component[0])?.specialty || 'Unspecified', referralDensity: sharedMembers.size / Math.max(componentClaims.length, 1), sharedLocationsCount: sharedFacilities.size, sharedOwnershipFlags: false, trajectory: networkRisk >= 60 ? 'ESCALATING' : 'STABLE', suspiciousSignals: Array.from(new Set(componentEvidence.map((item) => item.type))), topProviders: component.map((id) => { const provider = providers.find((item) => item.id === id)!; provider.networkId = networkId; provider.networkRiskScore = networkRisk; return { id, name: provider.name, risk: provider.riskScore, specialty: provider.specialty }; }), topFacilities: Array.from(sharedFacilities).map((id) => { const facility = facilities.find((item) => item.id === id)!; return { id, name: facility.name, risk: facility.riskScore }; }), propagationPath: [] });
    component.forEach((id) => { const provider = providers.find((item) => item.id === id)!; graphNodes.push({ id, label: provider.name, sublabel: provider.specialty, type: 'PROVIDER', riskScore: provider.riskScore, riskLevel: provider.riskLevel }); });
    Array.from(sharedFacilities).forEach((id) => graphNodes.push({ id, label: facilities.find((facility) => facility.id === id)?.name || id, type: 'FACILITY', riskScore: facilities.find((facility) => facility.id === id)?.riskScore || 0, riskLevel: riskLevel(facilities.find((facility) => facility.id === id)?.riskScore || 0) }));
    component.forEach((providerId) => Array.from(providerRows.get(providerId)!.facilities).filter((facilityId) => sharedFacilities.has(facilityId)).forEach((facilityId) => graphEdges.push({ id: `${providerId}-${facilityId}`, source: providerId, target: facilityId, type: 'OPERATES' })));
    component.forEach((left, index) => component.slice(index + 1).filter((right) => adjacency.get(left)!.has(right)).forEach((right) => graphEdges.push({ id: `${left}-${right}`, source: left, target: right, type: 'REFERS', label: 'Shared members', isSuspicious: networkRisk >= 60 })));
  });

  providers.forEach((provider) => {
    const data = providerRows.get(provider.id)!;
    const providerEvidence = evidence.filter((item) => item.entityId === provider.id);
    const affectedMembers = new Set(data.claims.filter((claim) => claim.flags.length > 0).map((claim) => claim.memberId)).size;
    const temporal = providerEvidence.some((item) => item.type === 'IMPOSSIBLE_TIMING') ? 100 : 0;
    const historical = Math.min(100, new Set(data.claims.map((claim) => claim.serviceDate)).size * 20);
    const financial = Math.min(100, (provider.suspiciousExposure || 0) / Math.max(provider.totalExposure || 1, 1) * 100);
    const member = Math.min(100, affectedMembers / Math.max(data.members.size, 1) * 100);
    const network = provider.networkRiskScore;
    const components = [
      { type: 'RULE_SEVERITY', component: Math.min(100, providerEvidence.length ? providerEvidence.reduce((sum, item) => sum + item.severity, 0) / providerEvidence.length : 0), weight: 0.25 },
      { type: 'BEHAVIORAL_ANOMALY', component: Math.min(100, data.claims.filter((claim) => claim.flags.length > 0).length / Math.max(data.claims.length, 1) * 100), weight: 0.2 },
      { type: 'TEMPORAL_ESCALATION', component: temporal, weight: 0.15 },
      { type: 'NETWORK_CORRELATION', component: network, weight: 0.15 },
      { type: 'HISTORICAL_BEHAVIOR', component: historical, weight: 0.1 },
      { type: 'FINANCIAL_EXPOSURE', component: financial, weight: 0.1 },
      { type: 'MEMBER_IMPACT', component: member, weight: 0.05 },
    ];
    const rawRisk = components.reduce((sum, item) => sum + item.component * item.weight, 0);
    provider.riskDrivers = components.map((item) => ({ type: item.type, component: Math.round(item.component), contribution: Math.round(item.component * item.weight) }));
    provider.riskScore = Math.round(Math.min(100, Math.max(0, rawRisk)));
    provider.riskLevel = riskLevel(provider.riskScore);
    provider.forecast30d = historical > 0 ? Math.min(100, Math.round(provider.riskScore * (1 + provider.trendDelta30d / 300))) : 0;
    provider.forecast60d = historical > 0 ? Math.min(100, Math.round(provider.riskScore * (1 + provider.trendDelta30d / 200))) : 0;
    provider.forecast90d = historical > 0 ? Math.min(100, Math.round(provider.riskScore * (1 + provider.trendDelta30d / 150))) : 0;
    provider.affectedMembers = affectedMembers;
    provider.evidenceCount = providerEvidence.length;
    provider.evidenceTypes = Array.from(new Set(providerEvidence.map((item) => item.type)));
    provider.riskHistory = [{ timestamp: now(), riskScore: provider.riskScore, reason: 'Computed from imported claim events and detector evidence', evidenceIds: providerEvidence.map((item) => item.evidenceId) }];
    provider.riskState = { analysisRunId, providerId: provider.id, currentRisk: provider.riskScore, evidenceStrength: provider.evidenceStrength, networkRisk: provider.networkRiskScore, suspiciousExposure: provider.suspiciousExposure || 0, affectedMembers, priorityScore: 0, riskHistory: [{ timestamp: now(), risk: provider.riskScore, evidenceIds: providerEvidence.map((item) => item.evidenceId) }], riskDrivers: provider.riskDrivers || [], lastUpdated: now() };
  });

  const timelines: DigitalTwinTimelinePoint[] = [];
  const topProvider = [...providers].sort((a, b) => b.riskScore - a.riskScore)[0];
  if (topProvider) {
    const providerClaims = providerRows.get(topProvider.id)!.claims;
    const periods = Array.from(new Set(providerClaims.map((claim) => claim.serviceDate))).sort();
    periods.forEach((period, index) => { const periodClaims = providerClaims.filter((claim) => claim.serviceDate === period); timelines.push({ periodLabel: period, daysOffset: index - periods.length + 1, isFuture: false, riskScore: index === periods.length - 1 ? topProvider.riskScore : Math.round(periodClaims.filter((claim) => claim.flags.length > 0).length / Math.max(periodClaims.length, 1) * 100), claimVolume: periodClaims.length, networkDegree: adjacency.get(topProvider.id)?.size || 0, estimatedExposure: periodClaims.filter((claim) => claim.flags.length > 0).reduce((sum, claim) => sum + claim.billedAmount, 0), referralDensity: 0, anomalyScore: periodClaims.filter((claim) => claim.flags.length > 0).length, summaryNote: `${periodClaims.length} claims observed; ${periodClaims.filter((claim) => claim.flags.length > 0).length} flagged by computed detectors.` }); });
    if (topProvider.riskState) topProvider.riskState.riskHistory = timelines.map((point) => ({ timestamp: point.periodLabel, risk: point.riskScore, evidenceIds: topProvider.riskState?.riskHistory.at(-1)?.evidenceIds || [] }));
  }

  const cases: CaseRecord[] = providers.map((provider, index): CaseRecord | null => {
    const providerEvidence = evidence.filter((item) => item.entityId === provider.id);
    const providerClaims = providerRows.get(provider.id)!.claims;
    const eligibility = evaluateSIUEligibility(provider, providerEvidence, provider.suspiciousExposure || 0);
    provider.siuEligible = eligibility.eligible;
    provider.siuEligibilityReasons = eligibility.reasons;
    provider.siuStatus = eligibility.eligible ? 'SIU_CASE' : provider.networkRiskScore >= 80 ? 'NETWORK_MONITORING' : 'MONITORED';
    if (import.meta.env.DEV && (provider.riskScore >= 75 || provider.id === 'P1029')) {
      console.debug('[SIU_PIPELINE]', {
        providerId: provider.id,
        claimCount: providerClaims.length,
        evidenceCount: providerEvidence.length,
        evidenceTypes: Array.from(new Set(providerEvidence.map((item) => item.type))),
        linkedClaimCount: eligibility.claimIds.length,
        totalExposure: provider.totalExposure,
        suspiciousExposure: eligibility.suspiciousExposure,
        riskScore: provider.riskScore,
        evidenceStrength: provider.evidenceStrength,
        networkRisk: provider.networkRiskScore,
        priorityScore: 'calculated below',
        siuEligible: eligibility.eligible,
        siuEligibilityReasons: eligibility.reasons,
        caseCreated: eligibility.eligible,
      });
    }
    if (!eligibility.eligible) return null;
    const affectedMembers = new Set(providerClaims.filter((claim) => claim.flags.length > 0).map((claim) => claim.memberId)).size;
    const network = networks.find((item) => item.id === provider.networkId);
    const memberImpact = Math.min(100, affectedMembers * 10 + providerEvidence.filter((item) => item.severity >= 80).length * 10);
    const exposureScore = Math.min(100, (eligibility.suspiciousExposure / 100000) * 100);
    const severityScore = providerEvidence.length ? providerEvidence.reduce((sum, item) => sum + item.severity, 0) / providerEvidence.length : 0;
    const priority = Math.round(provider.riskScore * 0.3 + exposureScore * 0.2 + memberImpact * 0.15 + severityScore * 0.15 + provider.evidenceStrength * 0.1 + provider.networkRiskScore * 0.1);
    if (provider.riskState) provider.riskState.priorityScore = priority;
    if (import.meta.env.DEV && (provider.riskScore >= 75 || provider.id === 'P1029')) console.debug('[SIU_PRIORITY]', { providerId: provider.id, priorityScore: priority, siuEligible: eligibility.eligible, caseCreated: true });
    const evidenceBreakdown: EvidenceItem[] = providerEvidence.map((item) => ({ id: item.evidenceId, ruleId: item.type, ruleName: item.type, category: item.type === 'UPCODING_PATTERN' ? 'UPCODING' : item.type === 'UNBUNDLING_PATTERN' ? 'UNBUNDLING' : item.type === 'EXCESSIVE_UTILIZATION' ? 'EXCESSIVE_UTILIZATION' : item.type === 'IMPOSSIBLE_TIMING' ? 'IMPOSSIBLE_TIMING' : 'DUPLICATE_BILLING', title: item.type, description: JSON.stringify(item.details), contributionScore: Math.round(item.severity * item.confidence / 100), weightPercentage: Math.round(item.severity / Math.max(providerEvidence.reduce((sum, evidenceItem) => sum + evidenceItem.severity, 0), 1) * 100), supportingRecordIds: item.claimIds, severity: riskLevel(item.severity), observedFact: `${item.type} detected from ${item.claimIds.length} imported claims.`, modelInference: `Detector confidence ${item.confidence}%.`, timestamp: item.createdAt }));
    return { id: `CASE-${String(index + 1).padStart(5, '0')}`, title: `${provider.name} computed investigation`, priorityScore: priority, priorityRank: 0, targetType: 'PROVIDER' as const, targetId: provider.id, providerId: provider.id, claimIds: eligibility.claimIds, evidenceIds: eligibility.evidenceIds, targetName: provider.name, networkId: provider.networkId, networkName: network?.name, specialty: provider.specialty, riskScore: provider.riskScore, riskLevel: provider.riskLevel, evidenceStrength: provider.evidenceStrength, forecastConfidence: provider.forecastConfidence, estimatedExposure: eligibility.suspiciousExposure, totalExposure: provider.totalExposure, suspiciousExposure: eligibility.suspiciousExposure, potentiallyAvoidableExposure: provider.potentiallyAvoidableExposure, evidenceTypes: Array.from(new Set(providerEvidence.map((item) => item.type))), memberImpactTier: (memberImpact >= 70 ? 'HIGH' : memberImpact >= 40 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW', memberImpactScore: memberImpact, potentialUnnecessaryProcedures: providerClaims.filter((claim) => claim.flags.length > 0).length, affectedMembersCount: affectedMembers, networkRiskScore: provider.networkRiskScore, forecast30d: provider.forecast30d, forecast60d: provider.forecast60d, forecast90d: provider.forecast90d, status: 'NEW' as const, assignedInvestigator: '', slaDaysRemaining: 0, lastUpdated: now(), createdAt: now(), evidenceBreakdown, whyNowDeltas: { claimVelocityChange: provider.trendDelta30d, highValueClaimSpike: provider.peerDeviationFactor, referralDensityChange: provider.referralDensity * 100, networkEntitiesAdded: network?.providerCount || 0, riskDelta30d: provider.trendDelta30d }, recommendedActions: evidenceBreakdown.map((item, actionIndex) => ({ id: `ACT-${index + 1}-${actionIndex + 1}`, actionText: `Review ${item.ruleName} evidence for ${item.supportingRecordIds.length} claims.`, category: 'Evidence Review', completed: false })), investigatorNotes: [{ id: `NOTE-${index + 1}`, author: 'Analysis Pipeline', timestamp: now(), content: `Created from ${providerClaims.length} claims, ${providerEvidence.length} evidence records, and ${events.length} ClaimSubmitted events.` }] };
  }).filter((candidate): candidate is CaseRecord => candidate !== null).sort((a, b) => b.priorityScore - a.priorityScore).map((item, index) => ({ ...item, priorityRank: index + 1 }));

  claims.forEach((claim) => { claim.riskScore = Math.min(100, claim.riskScore + (claim.flags.length ? 20 : 0)); });
  const integrityErrors: string[] = [];
  providers.forEach((provider) => {
    const providerEvidence = evidence.filter((item) => item.entityId === provider.id);
    const linkedClaimIds = new Set(providerEvidence.flatMap((item) => item.claimIds));
    if (providerEvidence.length > 0 && linkedClaimIds.size === 0) integrityErrors.push(`Provider ${provider.id} has evidence without linked claim IDs.`);
  });
  cases.forEach((investigation) => {
    const providerClaims = claims.filter((claim) => claim.providerId === investigation.targetId);
    const expectedExposure = providerClaims.filter((claim) => investigation.claimIds?.includes(claim.id)).reduce((sum, claim) => sum + claim.billedAmount, 0);
    if (Math.round(expectedExposure) !== Math.round(investigation.suspiciousExposure || 0)) integrityErrors.push(`Case ${investigation.id} suspicious exposure does not reconcile with the claim ledger.`);
    const expectedEvidence = evidence.filter((item) => item.entityId === investigation.targetId).length;
    if (expectedEvidence !== investigation.evidenceBreakdown.length) integrityErrors.push(`Case ${investigation.id} evidence count does not reconcile with evidence records.`);
    if ((investigation.suspiciousExposure || 0) > 0 && !(investigation.claimIds?.length)) integrityErrors.push(`Case ${investigation.id} has suspicious exposure without linked claims.`);
    if (investigation.evidenceStrength > 0 && !(investigation.evidenceIds?.length)) integrityErrors.push(`Case ${investigation.id} has evidence strength without evidence IDs.`);
    if (!providers.some((provider) => provider.id === investigation.targetId)) integrityErrors.push(`Case ${investigation.id} target entity does not exist in provider state.`);
  });
  networks.forEach((network) => {
    const networkProviders = graphNodes.filter((node) => node.type === 'PROVIDER' && network.topProviders.some((provider) => provider.id === node.id));
    if (networkProviders.length !== network.providerCount) integrityErrors.push(`Network ${network.id} provider membership does not reconcile with graph nodes.`);
  });
  if (integrityErrors.length > 0) console.error('DATA_INTEGRITY_ERROR:', integrityErrors);
  claims.forEach((claim) => { claim.analysisRunId = analysisRunId; });
  providers.forEach((provider) => { provider.analysisRunId = analysisRunId; });
  members.forEach((member) => { member.analysisRunId = analysisRunId; });
  facilities.forEach((facility) => { facility.analysisRunId = analysisRunId; });
  networks.forEach((network) => { network.analysisRunId = analysisRunId; });
  cases.forEach((investigation) => { investigation.analysisRunId = analysisRunId; });
  evidence.forEach((item) => { item.analysisRunId = analysisRunId; });
  const analysisRun: AnalysisRun = { runId: analysisRunId, datasetName, createdAt: now(), claimCount: claims.length, status: 'COMPLETED' };
  return { analysisRunId, analysisRun, claims, providers: providers.sort((a, b) => b.riskScore - a.riskScore), members, facilities, networks, cases, graphData: { nodes: graphNodes, edges: graphEdges }, timelinePoints: timelines, events, evidence, rejectedRows: rejected, warnings: evidence.length, integrityErrors };
}
