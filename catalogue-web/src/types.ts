export type Field = {
  id: string;
  value: string;
  status: "known" | "unknown" | "not_applicable";
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
};
export type Project = {
  id: string;
  name: string;
  catalogueVersion: string;
  revision: number;
  profile: Profile;
  selectedClusters: string[];
  recommendations: Recommendation[];
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
};
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
