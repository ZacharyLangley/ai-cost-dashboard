import { z } from 'zod';

export const monthParam = z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM');
export const monthsParam = z.coerce.number().int().min(1).max(24).default(6);
export const sortParam = z.enum(['cost', 'name', 'acceptance']).default('cost');
export const productParam = z.enum(['github', 'm365']);
export const groupByParam = z.enum(['product', 'team', 'model']).default('product');

export function currentMonth(): string {
  return new Date().toISOString().substring(0, 7);
}

export function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n + 1);
  return d.toISOString().substring(0, 7);
}
