import { useEffect, useState } from 'react';

interface HealthResponse {
  ok: boolean;
  ts: number;
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Copilot Cost Dashboard</h1>
      {error && <p className="text-red-500">{error}</p>}
      {health && (
        <pre className="bg-gray-100 p-4 rounded text-sm">{JSON.stringify(health, null, 2)}</pre>
      )}
    </div>
  );
}
