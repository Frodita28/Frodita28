import type { Frequency, Metric, ParticipationStatus } from "./missions";

export type MissionRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  frequency: Frequency;
  target_value: number;
  target_unit: string;
  metric: Metric;
  metric_params: Record<string, unknown>;
  plan_targets: Record<string, number>;
  xp_reward: number;
  difficulty: "baja" | "media" | "alta";
  start_at: string | null;
  end_at: string | null;
  evidence_required: boolean;
  evidence_instructions: string;
  validation_method: "auto" | "manual";
  applicable_license_plans: string[] | null;
  territory_rules: string[] | null;
  timezone: string;
  review_grace_days: number;
  status: "draft" | "active" | "inactive" | "archived";
  inactive_reason: string | null;
  updated_at: string;
};

export type ParticipationRow = {
  id: string;
  mission_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  target_value: number;
  xp_reward: number;
  current_progress: number | null;
  status: ParticipationStatus;
  evidence_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
};

export type EvidenceRow = {
  id: string;
  participation_id: string;
  mission_id: string;
  user_id: string;
  url: string | null;
  storage_path: string | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

export type LedgerRow = {
  id: number;
  user_id: string;
  amount: number;
  transaction_type: "mission_reward" | "admin_adjustment" | "reversal";
  mission_id: string | null;
  participation_id: string | null;
  description: string;
  created_at: string;
  created_by: string | null;
};
