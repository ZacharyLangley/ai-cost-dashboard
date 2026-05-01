import { ghFetch } from './client.js';
import { seatsResponseSchema } from './schemas.js';
import type { Seat } from './types.js';

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1] ?? null;
}

export async function fetchAllSeats(org: string): Promise<Seat[]> {
  const all: Seat[] = [];
  let url: string | null = `/orgs/${org}/copilot/billing/seats`;

  while (url) {
    const res = await ghFetch(url);
    const body: unknown = await res.json();
    const parsed = seatsResponseSchema.parse(body);
    all.push(...parsed.seats);
    url = parseNextLink(res.headers.get('Link'));
  }

  return all;
}
