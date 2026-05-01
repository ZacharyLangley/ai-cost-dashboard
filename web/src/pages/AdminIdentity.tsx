import { useState } from 'react';

interface ImportResult {
  added: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export default function AdminIdentity() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0]?.split(',').map((h) => h.trim().toLowerCase()) ?? [];
    const ghIdx = headers.indexOf('gh_username');
    const m365Idx = headers.indexOf('m365_upn');
    const displayIdx = headers.indexOf('display_name');
    const teamIdx = headers.indexOf('team');

    if (ghIdx === -1 && m365Idx === -1) {
      setError('CSV must have at least gh_username or m365_upn column');
      setLoading(false);
      return;
    }

    const rows = [];
    const errors: { row: number; message: string }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]?.split(',').map((c) => c.trim()) ?? [];
      if (!cols.some((c) => c)) continue;
      const row = {
        ghUsername: ghIdx >= 0 ? (cols[ghIdx] ?? '') : undefined,
        m365Upn: m365Idx >= 0 ? (cols[m365Idx] ?? '') : undefined,
        displayName: displayIdx >= 0 ? (cols[displayIdx] ?? '') : undefined,
        team: teamIdx >= 0 ? (cols[teamIdx] ?? '') : undefined,
      };
      if (!row.ghUsername && !row.m365Upn) {
        errors.push({ row: i + 1, message: 'Missing gh_username and m365_upn' });
      } else {
        rows.push(row);
      }
    }

    try {
      const res = await fetch('/api/admin/identity/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ImportResult;
      setResult({ ...data, errors: [...errors, ...(data.errors ?? [])] });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const sampleCsv = `gh_username,m365_upn,display_name,team
alice-dev,alice@company.com,Alice,Platform
bob-codes,bob@company.com,Bob,Backend`;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">Identity Management</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Import CSV</h2>
        <p className="mb-2 text-xs text-gray-500">
          Required columns: <code>gh_username</code> and/or <code>m365_upn</code>. Optional:{' '}
          <code>display_name</code>, <code>team</code>.
        </p>
        <details className="mb-3">
          <summary className="cursor-pointer text-xs text-blue-600 hover:underline">Show sample CSV</summary>
          <pre className="mt-2 rounded bg-gray-50 p-2 text-xs">{sampleCsv}</pre>
        </details>

        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-3 space-y-2">
            <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
              Added: {result.added}, Updated: {result.updated}
            </div>
            {result.errors.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <p className="font-medium">{result.errors.length} row errors:</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
