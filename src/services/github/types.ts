import type { z } from 'zod';
import type {
  usageItemSchema,
  usageResponseSchema,
  seatSchema,
  seatsResponseSchema,
  orgMetricsDaySchema,
  enterpriseUserReportRowSchema,
} from './schemas.js';

export type UsageItem = z.infer<typeof usageItemSchema>;
export type UsageResponse = z.infer<typeof usageResponseSchema>;
export type Seat = z.infer<typeof seatSchema>;
export type SeatsResponse = z.infer<typeof seatsResponseSchema>;
export type OrgMetricsDay = z.infer<typeof orgMetricsDaySchema>;
export type EnterpriseUserReportRow = z.infer<typeof enterpriseUserReportRowSchema>;

export interface PipelineResult {
  runId: number;
  status: 'success' | 'failed';
  rowsAffected: number;
}
