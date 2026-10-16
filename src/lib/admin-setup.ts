/** Constant-time comparison of the submitted setup code against the configured one. */
export function setupCodeMatches(submitted: string, expected: string): boolean {
  if (!expected) return false;
  const a = new TextEncoder().encode(submitted.trim());
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
