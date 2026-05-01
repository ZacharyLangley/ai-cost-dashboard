const ALLOWED_HOSTS = [
  'api.github.com',
  'objects.githubusercontent.com',
  'github-cloud.s3.amazonaws.com',
  'graph.microsoft.com',
];

export function assertSafeUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error(`Refusing non-HTTPS URL: ${parsed.protocol}`);
  }
  if (!ALLOWED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
    throw new Error(`URL host not in allowlist: ${parsed.hostname}`);
  }
}
