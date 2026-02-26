/**
 * Reasoning Generator — creates human-readable explanations for assignments
 */

import type { ReasonFactor } from './types';

/** Build a natural-language summary of why an employee was assigned */
export function buildSummary(
  employeeName: string,
  shiftLabel: string,
  factors: ReasonFactor[],
  runnerUp?: { name: string; score: number; gapReason: string },
  totalScore?: number
): string {
  const sorted = [...factors].sort((a, b) => b.weighted - a.weighted);
  const top3 = sorted.slice(0, 3);

  let summary = `${employeeName} was assigned to ${shiftLabel} primarily because: `;
  summary += top3.map(f => f.explanation.toLowerCase()).join('; ');
  summary += '.';

  if (runnerUp) {
    const scoreDiff = (totalScore || 0) - runnerUp.score;
    summary += ` Edged out ${runnerUp.name} by ${scoreDiff.toFixed(1)} points`;
    if (runnerUp.gapReason) {
      summary += ` (${runnerUp.gapReason})`;
    }
    summary += '.';
  }

  return summary;
}

/** Build a concise reason for why a runner-up wasn't selected */
export function buildRunnerUpGapReason(
  winnerFactors: ReasonFactor[],
  runnerUpFactors: ReasonFactor[]
): string {
  // Find the factor where the winner had the biggest advantage
  let maxGap = 0;
  let gapFactor = '';

  for (const wf of winnerFactors) {
    const rf = runnerUpFactors.find(f => f.name === wf.name);
    if (!rf) continue;
    const gap = wf.weighted - rf.weighted;
    if (gap > maxGap) {
      maxGap = gap;
      gapFactor = wf.name.toLowerCase();
    }
  }

  if (gapFactor) {
    return `winner scored higher on ${gapFactor}`;
  }
  return 'slight overall advantage';
}
