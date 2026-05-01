import { useState } from 'react';

export function useTeamFilter() {
  const [team, setTeam] = useState<string>('');
  return { team: team || undefined, setTeam };
}
