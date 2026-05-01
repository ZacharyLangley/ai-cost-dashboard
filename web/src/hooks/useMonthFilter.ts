import { useState } from 'react';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useMonthFilter() {
  const [month, setMonth] = useState<string>(currentMonth());
  return { month, setMonth };
}
