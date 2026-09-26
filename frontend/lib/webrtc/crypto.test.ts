import { describe, it, expect } from 'vitest';
import {
  generateEcdhPair, exportEcdhPublicKey, deriveAesKey,
  encrypt, decrypt, computeSafetyNumber,
} from './crypto';

describe('ECDH key agreement', () => {
  it('two independently generated pairs derive the identical shared AES key', async () => {
    const alice = await generateEcdhPair();
    const bob   = await generateEcdhPair();
    const aliceKey = await deriveAesKey(alice, await exportEcdhPublicKey(bob));
    const bobKey   = await deriveAesKey(bob, await exportEcdhPublicKey(alice));

    // Both are non-extractable CryptoKey objects, so we can't compare raw
    // bytes directly — prove equivalence the way the app actually cares
    // about: alice encrypts, bob decrypts (and vice versa) successfully.
    const msg = new TextEncoder().encode('shared secret round trip');
    const fromAlice = await encrypt(aliceKey, msg);
    expect(new TextDecoder().decode(await decrypt(bobKey, fromAlice))).toBe(
      'shared secret round trip',
    );
    const fromBob = await encrypt(bobKey, msg);
    expect(new TextDecoder().decode(await decrypt(aliceKey, fromBob))).toBe(
      'shared secret round trip',
    );
  });

  it('a third party cannot derive the same key from their own pair', async () => {
    const alice = await generateEcdhPair();
    const bob   = await generateEcdhPair();
    const eve   = await generateEcdhPair();

    const aliceKey = await deriveAesKey(alice, await exportEcdhPublicKey(bob));
    const eveKey   = await deriveAesKey(eve,   await exportEcdhPublicKey(bob));

    const ciphertext = await encrypt(aliceKey, new TextEncoder().encode('secret'));
    await expect(decrypt(eveKey, ciphertext)).rejects.toThrow();
  });

  it('exported public keys are distinct per generated pair', async () => {
    const a = await exportEcdhPublicKey(await generateEcdhPair());
    const b = await exportEcdhPublicKey(await generateEcdhPair());
    expect(a).not.toBe(b);
  });
});

describe('AES-GCM encrypt/decrypt', () => {
  it('round-trips arbitrary binary data exactly', async () => {
    const pair = await generateEcdhPair();
    const key = await deriveAesKey(pair, await exportEcdhPublicKey(await generateEcdhPair()));
    const original = new Uint8Array([0, 1, 2, 255, 254, 128, 42, 0, 0, 17]);

    const ciphertext = await encrypt(key, original);
    const decrypted = await decrypt(key, ciphertext);

    expect(Array.from(decrypted)).toEqual(Array.from(original));
  });

  it('two encryptions of the same plaintext produce different ciphertext (fresh IV every time)', async () => {
    const pair = await generateEcdhPair();
    const key = await deriveAesKey(pair, await exportEcdhPublicKey(await generateEcdhPair()));
    const plaintext = new TextEncoder().encode('identical message');

    const a = await encrypt(key, plaintext);
    const b = await encrypt(key, plaintext);

    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('rejects a tampered ciphertext (auth tag fails) instead of silently returning garbage', async () => {
    const pair = await generateEcdhPair();
    const key = await deriveAesKey(pair, await exportEcdhPublicKey(await generateEcdhPair()));
    const ciphertext = await encrypt(key, new TextEncoder().encode('integrity matters'));

    const tampered = new Uint8Array(ciphertext);
    tampered[tampered.length - 1] ^= 0xff; // flip a bit in the auth tag

    await expect(decrypt(key, tampered)).rejects.toThrow();
  });

  it('prepends a 12-byte IV to the ciphertext', async () => {
    const pair = await generateEcdhPair();
    const key = await deriveAesKey(pair, await exportEcdhPublicKey(await generateEcdhPair()));
    const plaintext = new Uint8Array(10);

    const frame = await encrypt(key, plaintext);

    // AES-GCM auth tag is 16 bytes, so total = 12 (IV) + 10 (plaintext) + 16 (tag).
    expect(frame.byteLength).toBe(12 + 10 + 16);
  });
});

describe('computeSafetyNumber', () => {
  it('both peers compute the identical number regardless of argument order (sorted internally)', async () => {
    const a = 'AAAApublickeyBBBB';
    const b = 'ZZZZpublickeyYYYY';

    const fromAlice = await computeSafetyNumber(a, b);
    const fromBob   = await computeSafetyNumber(b, a);

    expect(fromAlice).toBe(fromBob);
  });

  it('is deterministic for the same inputs', async () => {
    const n1 = await computeSafetyNumber('keyA', 'keyB');
    const n2 = await computeSafetyNumber('keyA', 'keyB');
    expect(n1).toBe(n2);
  });

  it('changes if either public key changes (sensitive to both, not a placebo)', async () => {
    const base = await computeSafetyNumber('keyA', 'keyB');
    const changedFirst  = await computeSafetyNumber('keyA-tampered', 'keyB');
    const changedSecond = await computeSafetyNumber('keyA', 'keyB-tampered');

    expect(changedFirst).not.toBe(base);
    expect(changedSecond).not.toBe(base);
  });

  it('formats as 6 groups of 4 digits', async () => {
    const number = await computeSafetyNumber('someKeyA', 'someKeyB');
    expect(number).toMatch(/^\d{4}( \d{4}){5}$/);
  });
});
