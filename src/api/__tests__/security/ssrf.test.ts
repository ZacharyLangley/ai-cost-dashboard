import { describe, it, expect } from 'vitest';
import { assertSafeUrl } from '../../../lib/safe-fetch.js';

describe('assertSafeUrl', () => {
  it('allows api.github.com', () => {
    expect(() => assertSafeUrl('https://api.github.com/repos/org/data')).not.toThrow();
  });

  it('allows objects.githubusercontent.com', () => {
    expect(() => assertSafeUrl('https://objects.githubusercontent.com/data.ndjson')).not.toThrow();
  });

  it('allows github-cloud.s3.amazonaws.com', () => {
    expect(() => assertSafeUrl('https://github-cloud.s3.amazonaws.com/data')).not.toThrow();
  });

  it('allows graph.microsoft.com', () => {
    expect(() => assertSafeUrl('https://graph.microsoft.com/v1.0/users')).not.toThrow();
  });

  it('rejects non-HTTPS URLs', () => {
    expect(() => assertSafeUrl('http://api.github.com/data')).toThrow('Refusing non-HTTPS URL');
  });

  it('rejects non-allowlisted hosts', () => {
    expect(() => assertSafeUrl('https://evil.com/data.ndjson')).toThrow('URL host not in allowlist');
  });

  it('rejects partial host matches (e.g. evilapi.github.com.attacker.com)', () => {
    expect(() => assertSafeUrl('https://api.github.com.attacker.com/data')).toThrow('URL host not in allowlist');
  });

  it('rejects file:// protocol', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow('Refusing non-HTTPS URL');
  });
});
