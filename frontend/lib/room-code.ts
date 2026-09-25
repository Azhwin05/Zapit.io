// Omits visually ambiguous characters: O (like 0), I (like 1)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Rejection-sampling to remove modulo bias when array length doesn't divide 2^32 evenly.
function cryptoRandBelow(max: number): number {
  const buf = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % max);
  let v: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limit);
  return v % max;
}

export function generateRoomCode(): string {
  return Array.from({ length: 6 }, () => CHARS[cryptoRandBelow(CHARS.length)]).join('');
}

// Strip spaces and hyphens, uppercase — handles "82 E6 F9", "82-E6-F9", etc.
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/[\s\-]/g, '').toUpperCase();
}

export function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}
