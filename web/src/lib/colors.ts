export const COLORS = {
  ghSeats: '#1f2937',
  ghUsage: '#0969da',
  m365Seats: '#0078d4',
  idle: '#d97706',
  success: '#16a34a',
  danger: '#dc2626',
  muted: '#6b7280',
};

export function teamColor(teamName: string): string {
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = (hash << 5) - hash + teamName.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export const MODEL_COLORS: Record<string, string> = {
  'claude-sonnet-4-6': '#7c3aed',
  'claude-opus-4-7': '#dc2626',
  'claude-haiku-4-5': '#2563eb',
  'gpt-4o': '#16a34a',
  'gpt-4-turbo': '#0d9488',
  'gpt-4': '#0891b2',
  'o1': '#ea580c',
  'o3-mini': '#d97706',
};

export function modelColor(model: string): string {
  return MODEL_COLORS[model] ?? '#6b7280';
}
