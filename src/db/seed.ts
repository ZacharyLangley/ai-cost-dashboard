import { db, sqlite } from './client.js';
import {
  ghUsageFacts,
  ghSeats,
  ghMetricsDaily,
  m365UsageFacts,
  m365AppActivity,
  identityMap,
  pipelineRuns,
} from './schema/index.js';

const USERS = [
  { gh: 'alice-dev', m365: 'alice@company.com', name: 'Alice Chen', team: 'Platform' },
  { gh: 'bob-codes', m365: 'bob@company.com', name: 'Bob Smith', team: 'Platform' },
  { gh: 'carol-eng', m365: 'carol@company.com', name: 'Carol White', team: 'Frontend' },
  { gh: 'dave-builds', m365: 'dave@company.com', name: 'Dave Jones', team: 'Frontend' },
  { gh: 'eve-hacks', m365: 'eve@company.com', name: 'Eve Martinez', team: 'Backend' },
  { gh: 'frank-dev', m365: 'frank@company.com', name: 'Frank Lee', team: 'Backend' },
  { gh: 'grace-eng', m365: 'grace@company.com', name: 'Grace Kim', team: 'DevOps' },
  { gh: 'henry-codes', m365: 'henry@company.com', name: 'Henry Brown', team: 'DevOps' },
];

const MODELS = [
  { model: 'claude-sonnet-4-6', pricePerUnit: 0.04 },
  { model: 'claude-opus-4', pricePerUnit: 0.15 },
  { model: 'gpt-4o', pricePerUnit: 0.05 },
  { model: 'gemini-1.5-pro', pricePerUnit: 0.035 },
];

const IDES = ['vscode', 'jetbrains', 'neovim'];

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function billingMonths(count: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return months;
}

function datesInMonth(billingMonth: string): string[] {
  const [y, m] = billingMonth.split('-').map(Number) as [number, number];
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) =>
    `${billingMonth}-${String(i + 1).padStart(2, '0')}`,
  );
}

function lastNDates(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().split('T')[0]!;
  });
}

const pulledAt = new Date().toISOString();
const today = new Date().toISOString().split('T')[0]!;
const months = billingMonths(3);

console.log('Seeding identity_map...');
for (const u of USERS) {
  await db
    .insert(identityMap)
    .values({ ghUsername: u.gh, m365Upn: u.m365, displayName: u.name, team: u.team })
    .onConflictDoUpdate({
      target: identityMap.ghUsername,
      set: { m365Upn: u.m365, displayName: u.name, team: u.team },
    });
}

console.log('Seeding gh_usage_facts...');
for (const month of months) {
  for (const user of USERS) {
    for (const { model, pricePerUnit } of MODELS) {
      if (Math.random() < 0.3) continue; // not every user uses every model each month
      const grossQty = rnd(50, 800);
      const discountQty = Math.floor(grossQty * 0.1);
      const netQty = grossQty - discountQty;
      await db.insert(ghUsageFacts).values({
        billingMonth: month,
        username: user.gh,
        product: 'Copilot',
        sku: 'Copilot Premium Request',
        model,
        unitType: 'requests',
        pricePerUnit,
        grossQty,
        grossAmount: +(grossQty * pricePerUnit).toFixed(4),
        discountQty,
        discountAmount: +(discountQty * pricePerUnit).toFixed(4),
        netQty,
        netAmount: +(netQty * pricePerUnit).toFixed(4),
        pulledAt,
      }).onConflictDoUpdate({
        target: [ghUsageFacts.billingMonth, ghUsageFacts.username, ghUsageFacts.sku, ghUsageFacts.model],
        set: { netQty, netAmount: +(netQty * pricePerUnit).toFixed(4), pulledAt },
      });
    }
  }
}

console.log('Seeding gh_seats...');
for (const user of USERS) {
  // Some users inactive >30 days
  const daysAgo = user.gh.startsWith('grace') || user.gh.startsWith('henry') ? rnd(35, 90) : rnd(0, 15);
  const lastActivity = new Date();
  lastActivity.setUTCDate(lastActivity.getUTCDate() - daysAgo);
  await db.insert(ghSeats).values({
    snapshotDate: today,
    username: user.gh,
    planType: 'business',
    seatCostUsd: 19,
    lastActivityAt: lastActivity.toISOString(),
    assigneeTeam: user.team,
  }).onConflictDoUpdate({
    target: [ghSeats.snapshotDate, ghSeats.username],
    set: { lastActivityAt: lastActivity.toISOString() },
  });
}

console.log('Seeding gh_metrics_daily...');
for (const date of lastNDates(30)) {
  for (const user of USERS) {
    if (Math.random() < 0.2) continue; // ~80% daily active
    const ide = IDES[rnd(0, IDES.length - 1)]!;
    const suggestions = rnd(20, 200);
    const acceptances = Math.floor(suggestions * (0.2 + Math.random() * 0.5));
    await db.insert(ghMetricsDaily).values({
      metricDate: date,
      username: user.gh,
      ide,
      feature: 'completions',
      suggestions,
      acceptances,
    }).onConflictDoUpdate({
      target: [ghMetricsDaily.metricDate, ghMetricsDaily.username, ghMetricsDaily.ide, ghMetricsDaily.feature],
      set: { suggestions, acceptances },
    });
  }
}

console.log('Seeding m365_usage_facts...');
for (const pullDate of lastNDates(3)) {
  for (const user of USERS) {
    const daysAgo = rnd(0, 60);
    const lastActivity = new Date();
    lastActivity.setUTCDate(lastActivity.getUTCDate() - daysAgo);
    await db.insert(m365UsageFacts).values({
      pullDate,
      upn: user.m365,
      upnIsHashed: false,
      displayName: user.name,
      lastActivity: lastActivity.toISOString().split('T')[0]!,
      daysSinceActive: daysAgo,
      seatSku: 'Microsoft 365 Copilot',
      seatCostUsd: 30,
    }).onConflictDoUpdate({
      target: [m365UsageFacts.pullDate, m365UsageFacts.upn],
      set: { daysSinceActive: daysAgo, lastActivity: lastActivity.toISOString().split('T')[0]! },
    });
  }
}

console.log('Seeding m365_app_activity...');
const M365_APPS = ['teams', 'word', 'excel', 'powerpoint', 'outlook'];
for (const user of USERS) {
  const activeApps = M365_APPS.filter(() => Math.random() > 0.4);
  for (const app of activeApps) {
    const daysAgo = rnd(0, 30);
    const lastActive = new Date();
    lastActive.setUTCDate(lastActive.getUTCDate() - daysAgo);
    await db.insert(m365AppActivity).values({
      pullDate: today,
      upn: user.m365,
      app,
      lastActive: lastActive.toISOString().split('T')[0]!,
    }).onConflictDoUpdate({
      target: [m365AppActivity.pullDate, m365AppActivity.upn, m365AppActivity.app],
      set: { lastActive: lastActive.toISOString().split('T')[0]! },
    });
  }
}

console.log('Seeding pipeline_runs...');
await db.insert(pipelineRuns).values([
  { pipeline: 'github', startedAt: new Date(Date.now() - 3_600_000).toISOString(), finishedAt: new Date(Date.now() - 3_599_000).toISOString(), status: 'success', rowsAffected: 120 },
  { pipeline: 'm365', startedAt: new Date(Date.now() - 7_200_000).toISOString(), finishedAt: new Date(Date.now() - 7_199_000).toISOString(), status: 'success', rowsAffected: 48 },
]);

console.log('Seed complete.');
sqlite.close();
