import { describe, it, expect } from 'vitest';
import { remapSignalingHost, buildShareUrl } from './share-url';

describe('remapSignalingHost', () => {
  it('rewrites localhost to the LAN host', () => {
    expect(remapSignalingHost('wss://localhost:8787', '192.168.1.42')).toBe('wss://192.168.1.42:8787');
  });

  it('rewrites 127.0.0.1 to the LAN host', () => {
    expect(remapSignalingHost('wss://127.0.0.1:8787', '10.0.0.5')).toBe('wss://10.0.0.5:8787');
  });

  it('leaves a real LAN IP unchanged', () => {
    expect(remapSignalingHost('wss://192.168.1.42:8787', '192.168.1.99')).toBe('wss://192.168.1.42:8787');
  });

  it('leaves a public hostname unchanged', () => {
    expect(remapSignalingHost('wss://signal.zapit.io', '192.168.1.42')).toBe('wss://signal.zapit.io');
  });

  it('preserves the ws:// scheme when remapping', () => {
    expect(remapSignalingHost('ws://localhost:8787', '192.168.1.42')).toBe('ws://192.168.1.42:8787');
  });

  it('passes through an unparseable value untouched', () => {
    expect(remapSignalingHost('not a url', '192.168.1.42')).toBe('not a url');
  });
});

describe('buildShareUrl', () => {
  it('builds a plain join link when no signaling URL is given', () => {
    expect(buildShareUrl('https://192.168.1.42:3210', 'ABC123')).toBe('https://192.168.1.42:3210?join=ABC123');
  });

  it('treats null/empty signaling as no override', () => {
    expect(buildShareUrl('https://zapit.io', 'ABC123', null)).toBe('https://zapit.io?join=ABC123');
    expect(buildShareUrl('https://zapit.io', 'ABC123', '')).toBe('https://zapit.io?join=ABC123');
  });

  it('appends the signaling URL, encoded, in LAN mode', () => {
    expect(buildShareUrl('https://192.168.1.42:3210', 'ABC123', 'wss://192.168.1.42:8787')).toBe(
      'https://192.168.1.42:3210?join=ABC123&signaling=wss%3A%2F%2F192.168.1.42%3A8787',
    );
  });
});
