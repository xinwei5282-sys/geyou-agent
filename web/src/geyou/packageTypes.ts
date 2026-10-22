import type { Line, ServiceTask } from './types';

export type NeedDecision = 'needed' | 'prepared' | 'undecided' | 'not-needed';
// transport is retained only to read and migrate older local records.
export type NeedKey = 'clothes' | 'urn' | 'transport' | 'ceremony' | 'decoration' | 'flowers' | 'burial';

export type SalePackage = {
  id: string;
  title: string;
  lines: Line[];
  total: number;
  reasons: string[];
  profileReasons?: string[];
  overBudget: number;
  recommended: boolean;
};

export type ConsultationPlan = {
  phase: 'process' | 'scope' | 'packages' | 'result';
  processPosition: 'advance' | 'immediate' | 'farewell' | 'burial' | 'aftercare';
  needs: Partial<Record<NeedKey, NeedDecision>>;
  scopeConfirmed: boolean;
  packages: SalePackage[];
  selectedPackageId?: string;
  selectedLines?: Line[];
  continuation: 'continue' | 'undecided' | 'none';
  outcome?: 'consulting' | 'confirmed';
  confirmedAt?: string;
  followupDate?: string;
  followupNote?: string;
  processExplained?: boolean;
  processFocus?: string;
  warnings?: string[];
  missingNeeds?: NeedKey[];
  followupTaskId?: string;
  followupTask?: ServiceTask;
  continuedFrom?: string;
};
