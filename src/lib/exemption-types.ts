/**
 * Exemption Types and Constants
 * 
 * Separated from exemptions.ts to avoid bundling sql.js in client components.
 * See ADR 003 section 6 for exemption system design.
 */

// WHY: Predefined reasons from PRD 001 section 3.7
export const EXEMPTION_REASONS = [
  'Private property',
  'Highway / Major road',
  'Water / River',
  'Construction zone',
  'Fenced area',
  'Other'
] as const;

export type ExemptionReason = typeof EXEMPTION_REASONS[number];

export interface Exemption {
  id: number;
  deviationId: number;
  reason: ExemptionReason;
  customReason?: string; // Required if reason is 'Other'
  exemptedAt: string;
}

export interface DeviationWithExemption {
  id: number;
  walkAnalysisId: number;
  startPointIndex: number;
  endPointIndex: number;
  borderGapMeters: number;
  detourDistanceMeters: number;
  maxDeviationMeters: number;
  classification: 'obstacle_avoidance' | 'shortcut' | 'drift';
  isExempt: boolean;
  exemptionReason: string | null;
  exemptedAt: string | null;
}
