import { describe, it, expect } from 'vitest';
import { generateRoomCode, normalizeCode, isValidCode } from './room-code';

describe('generateRoomCode', () => {
  it('generates a 6-character code', () => {
    expect(generateRoomCode()).toHaveLength(6);
  });

  it('only uses the visually-unambiguous character set (no 0/O, 1/I confusion)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('produces varied output across many calls (not a constant or low-entropy generator)', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateRoomCode()));
    // 500 draws from a keyspace of 33^6 (~1.3 billion) should essentially
    // never collide — this is really a smoke test that the RNG isn't stuck.
    expect(codes.size).toBe(500);
  });
});

describe('normalizeCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeCode('abcdef')).toBe('ABCDEF');
  });

  it('strips spaces', () => {
    expect(normalizeCode('82 E6 F9')).toBe('82E6F9');
  });

  it('strips hyphens', () => {
    expect(normalizeCode('82-E6-F9')).toBe('82E6F9');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeCode('  82E6F9  ')).toBe('82E6F9');
  });

  it('handles a mix of all of the above at once', () => {
    expect(normalizeCode('  8a -e6 f9 ')).toBe('8AE6F9');
  });
});

describe('isValidCode', () => {
  it('accepts a well-formed 6-char alphanumeric code', () => {
    expect(isValidCode('ABC123')).toBe(true);
  });

  it('rejects codes that are too short', () => {
    expect(isValidCode('ABC12')).toBe(false);
  });

  it('rejects codes that are too long', () => {
    expect(isValidCode('ABC1234')).toBe(false);
  });

  it('rejects lowercase (normalizeCode should be applied first)', () => {
    expect(isValidCode('abc123')).toBe(false);
  });

  it('rejects codes containing spaces or punctuation', () => {
    expect(isValidCode('AB 123')).toBe(false);
    expect(isValidCode('AB-123')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidCode('')).toBe(false);
  });
});
