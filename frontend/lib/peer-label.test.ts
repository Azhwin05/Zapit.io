import { describe, it, expect } from 'vitest';
import { peerLabel } from './peer-label';

describe('peerLabel', () => {
  it('prefixes with "Device " and truncates to the first 6 characters', () => {
    expect(peerLabel('a1b2c3d4-e5f6-7890')).toBe('Device a1b2c3');
  });

  it('handles an id shorter than 6 characters without throwing', () => {
    expect(peerLabel('abc')).toBe('Device abc');
  });

  it('two different peerIds sharing no prefix produce different labels', () => {
    expect(peerLabel('111111-x')).not.toBe(peerLabel('222222-x'));
  });
});
