import { z } from 'zod';

// [SPECULATION] user field present when called without user filter
export const usageItemSchema = z
  .object({
    user: z.string().optional(),
    product: z.string(),
    sku: z.string(),
    model: z.string(),
    unitType: z.string(),
    pricePerUnit: z.number(),
    grossQuantity: z.number().int(),
    grossAmount: z.number(),
    discountQuantity: z.number().int(),
    discountAmount: z.number(),
    netQuantity: z.number().int(),
    netAmount: z.number(),
  })
  .passthrough();

// [SPECULATION] top-level response shape
export const usageResponseSchema = z
  .object({
    usageItems: z.array(usageItemSchema),
  })
  .passthrough();

export const seatSchema = z
  .object({
    created_at: z.string(),
    updated_at: z.string(),
    pending_cancellation_date: z.string().nullable().optional(),
    last_activity_at: z.string().nullable().optional(),
    last_activity_editor: z.string().nullable().optional(),
    plan_type: z.string(),
    assignee: z.object({ login: z.string() }).passthrough(),
    assigning_team: z.object({ slug: z.string() }).passthrough().optional(),
  })
  .passthrough();

export const seatsResponseSchema = z
  .object({
    total_seats: z.number().int(),
    seats: z.array(seatSchema),
  })
  .passthrough();

export const orgMetricsEditorModelSchema = z
  .object({
    name: z.string(),
    total_engaged_users: z.number().int(),
    total_code_suggestions: z.number().int().optional(),
    total_code_acceptances: z.number().int().optional(),
  })
  .passthrough();

export const orgMetricsDaySchema = z
  .object({
    date: z.string(),
    total_active_users: z.number().int(),
    total_engaged_users: z.number().int(),
    copilot_ide_code_completions: z
      .object({
        total_engaged_users: z.number().int(),
        editors: z
          .array(
            z
              .object({
                name: z.string(),
                total_engaged_users: z.number().int(),
                models: z.array(orgMetricsEditorModelSchema).optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
    copilot_ide_chat: z
      .object({
        total_engaged_users: z.number().int(),
        editors: z
          .array(
            z.object({ name: z.string(), total_engaged_users: z.number().int() }).passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const orgMetricsResponseSchema = z.array(orgMetricsDaySchema);

// [SPECULATION] enterprise NDJSON per-user report row shape
export const enterpriseUserReportRowSchema = z
  .object({
    date: z.string(),
    login: z.string(),
    editor: z.string().optional(),
    feature: z.string().optional(),
    suggestions: z.number().int().optional(),
    acceptances: z.number().int().optional(),
  })
  .passthrough();

export const enterpriseMetricsLinkSchema = z
  .object({
    download_url: z.string(),
    expires_at: z.string().optional(),
  })
  .passthrough();
