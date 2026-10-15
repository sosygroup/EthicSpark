export type Field = {
  id: string;
  value: string;
  status: "known" | "unknown" | "not_applicable" | "none" | "company_ethics";
  files?: string[];
  companyEthics?: string[];
};
export type Profile = { version: number; confirmed: boolean; fields: Field[] };
export type Recommendation = {
  sourceActionId: string;
  scenario: string;
  action: string;
  evidence: string;
  criterion: string;
  owner: string;
  rationale: string;
  phases: string[];
  reviewStatus: string;
  implementationStatus: string;
  reason: string;
  applicability?: "suitable" | "not_applicable" | "uncertain";
  applicabilityReason?: string;
};
export type Project = {
  id: string;
  name: string;
  catalogueVersion: string;
  revision: number;
  profile: Profile;
  selectedClusters: string[];
  recommendations: Recommendation[];
  reasoning?: ReasoningRun | null;
};
export type Summary = {
  id: string;
  name: string;
  revision: number;
  profileVersion: number;
  confirmed: boolean;
  updatedAt: string;
};
export type Action = {
  id: string;
  category: string;
  text: string;
  concerns: string[];
  evidence: string;
  phases: string[];
  allPhases: boolean;
  roles: string[];
  referenceIds: string[];
  source: string;
};
export type Cluster = {
  id: string;
  title: string;
  definition: string;
  concerns: string[];
  semanticRationale: string;
  boundaries: string;
  labelMappings: { card: string; characteristic: string }[];
  referenceIds: string[];
  actions: Action[];
};
export type ClusterSummary = {
  id: string;
  title: string;
  definition: string;
  concerns: string[];
  actionCount: number;
};
export type Plan = {
  id: string;
  kind: string;
  version: number;
  projectRevision: number;
  profile: Profile;
  actor: string;
  at: string;
  entries: { recommendation: Recommendation; source: Action }[];
  gaps: string[];
  excludedActionIds: string[];
  origin?: string;
  reasoning?: ReasoningRun | null;
};
export type Attachment = { id: string; fieldId: string; name: string; mediaType: string; size: number; sha256: string; text: string; extraction: string };
export type Mapping = { card: string; characteristic: string };
export type ClusterProposal = { clusterId: string; rationale: string; mappings: Mapping[] };
export type ReasoningRun = { id: string; revision: number; provider: string; model: string; promptVersion: string; output: { clusters: ClusterProposal[]; recommendations: Recommendation[]; uncertainties: string[] } };
export type Event = {
  id: string;
  actor: string;
  at: string;
  operation: string;
  sourceActionId?: string;
  reason: string;
  before: unknown;
  after: unknown;
};
