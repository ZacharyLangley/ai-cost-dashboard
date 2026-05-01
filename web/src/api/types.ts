export interface DeveloperSummary {
  username: string;
  displayName: string;
  team: string;
  ghUsageCost: number;
  ghSeatCost: number;
  m365SeatCost: number;
  totalCost: number;
  totalRequests: number;
  modelCount: number;
  lastActivityAt: string | null;
  daysIdle: number | null;
}

export interface MonthlyTrend {
  billingMonth: string;
  cost: number;
  requests: number;
}

export interface ModelBreakdown {
  model: string;
  cost: number;
  requests: number;
}

export interface AppActivity {
  app: string;
  lastActive: string | null;
}

export interface DeveloperDetail {
  identity: {
    ghUsername: string | null;
    displayName: string;
    team: string;
    m365Upn: string | null;
  };
  monthly: MonthlyTrend[];
  modelMix: ModelBreakdown[];
  acceptanceRate: number | null;
  m365Apps: AppActivity[];
  idle: { github: boolean; daysIdle: number | null };
}

export interface TeamSummary {
  team: string;
  devCount: number;
  ghUsageCost: number;
  totalCost: number;
}

export interface TeamTrend {
  billingMonth: string;
  cost: number;
  devCount: number;
}

export interface TeamDetail {
  monthly: TeamTrend[];
  developers: DeveloperSummary[];
  topModels: { model: string; cost: number; requests: number }[];
}

export interface OrgSummary {
  totalCostMonth: number;
  breakdown: { ghSeats: number; ghUsage: number; m365Seats: number };
  activeDevs: number;
  idleSeats: { github: number; m365: number };
  unmappedCount: number;
}

export interface IdleSeat {
  username: string;
  displayName: string | null;
  team: string | null;
  product: string;
  seatCostUsd: number;
  lastActivityAt: string | null;
  daysIdle: number | null;
}

export interface TrendPoint {
  period: string;
  group: string;
  cost: number;
}

export interface GithubModel {
  model: string;
  totalCost: number;
  totalQty: number;
  userCount: number;
}

export interface AcceptanceVsCost {
  username: string;
  displayName: string;
  team: string;
  completionsCost: number;
  acceptanceRate: number | null;
}

export interface M365HeatmapRow {
  upn: string;
  displayName: string;
  team: string;
  apps: Record<string, string | null>;
}

export interface M365BreadthRow {
  upn: string;
  displayName: string;
  team: string;
  appCount: number;
  apps: string[];
}

export interface PipelineStatus {
  pipeline: string;
  lastRun: string | null;
  status: string;
  rowsAffected: number | null;
}

export interface ApiDriftEntry {
  id: number;
  source: string;
  fieldPath: string;
  value: string | null;
  sample: string | null;
  detectedAt: string;
}

export interface HashingStatus {
  m365UpnHashed: boolean;
  lastDetectedAt: string | null;
}
