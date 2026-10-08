import { SimulationResult } from '../types';

export interface SimulationParams {
  claimGrowthPercent: number; // e.g. 40%
  referralGrowthPercent: number; // e.g. 20%
  networkExpansionCount: number; // e.g. 2
  highValueSpikePercent: number; // e.g. 35%
  interventionIntensityPercent: number; // e.g. 65%
}

export function runWhatIfSimulation(
  currentRisk: number,
  currentExposure: number,
  currentNetworkSize: number,
  params: SimulationParams
): SimulationResult {
  const {
    claimGrowthPercent,
    referralGrowthPercent,
    networkExpansionCount,
    highValueSpikePercent,
    interventionIntensityPercent,
  } = params;

  // Unchecked trajectory (Scenario A)
  const compoundMultiplier =
    1 + (claimGrowthPercent * 0.4 + referralGrowthPercent * 0.3 + highValueSpikePercent * 0.3) / 100;

  const rawRisk30dA = Math.min(99, Math.round(currentRisk * (1 + (compoundMultiplier - 1) * 0.25)));
  const rawRisk60dA = Math.min(99, Math.round(currentRisk * (1 + (compoundMultiplier - 1) * 0.55)));
  const rawRisk90dA = Math.min(99, Math.round(currentRisk * (1 + (compoundMultiplier - 1) * 0.85)));

  const exposureFactorA = 1 + (claimGrowthPercent / 100) * 1.6 + (highValueSpikePercent / 100) * 0.8;
  const rawExposure90dA = Math.round(currentExposure * exposureFactorA);
  const rawNetworkSize90dA = currentNetworkSize + networkExpansionCount;

  // Intervention trajectory (Scenario B)
  // Simulated SIU review reduces trajectory velocity
  const reductionFactor = Math.min(0.7, (interventionIntensityPercent / 100) * 0.65);

  const rawRisk30dB = Math.max(35, Math.round(currentRisk * (1 - reductionFactor * 0.35)));
  const rawRisk60dB = Math.max(28, Math.round(currentRisk * (1 - reductionFactor * 0.65)));
  const rawRisk90dB = Math.max(22, Math.round(currentRisk * (1 - reductionFactor * 0.95)));

  const exposureFactorB = Math.max(1.05, 1 + (claimGrowthPercent / 100) * 0.2 - reductionFactor * 0.4);
  const rawExposure90dB = Math.round(currentExposure * exposureFactorB);
  const rawNetworkSize90dB = Math.max(1, currentNetworkSize - Math.floor(networkExpansionCount * 0.5));

  return {
    parameters: params,
    scenarioA: {
      name: 'Status Quo (No Intervention)',
      description: 'Claims continue adjudicating with escalating claim velocity, uncurbed referral loops, and expanding provider nodes.',
      risk30d: rawRisk30dA,
      risk60d: rawRisk60dA,
      risk90d: rawRisk90dA,
      exposure90d: rawExposure90dA,
      networkSize90d: rawNetworkSize90dA,
    },
    scenarioB: {
      name: 'Simulated SIU Review & Targeted Audits',
      description: 'Model assumes active clinical record audits, pre-pay edit holds on duplicate CPT pairs, and Stark compliance inquiries.',
      risk30d: rawRisk30dB,
      risk60d: rawRisk60dB,
      risk90d: rawRisk90dB,
      exposure90d: rawExposure90dB,
      networkSize90d: rawNetworkSize90dB,
    },
  };
}
