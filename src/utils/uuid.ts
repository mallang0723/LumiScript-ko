/** Generate a UUID v4 (uses the Web Crypto API, available in both Bun and browser) */
export function generateUUID(): string {
  // randomUUID is undefined in insecure contexts (plain http / non-localhost, e.g. LAN or phone access),
  // so fall back to getRandomValues (available everywhere) instead of throwing.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Generate a short ID — 8 random hex chars.
 * Not cryptographically unique at scale, but sufficient for in-session IDs.
 */
export function generateShortId(): string {
  return generateUUID().replace(/-/g, '').slice(0, 8);
}
