'use client';

/**
 * Session-scoped AES-GCM-256 encryption with ephemeral ECDH key agreement.
 *
 * Key exchange (ECDH P-256):
 *   Each peer generates a fresh ephemeral key pair per connection.
 *   Public keys are exchanged via the signaling channel; the shared AES key is
 *   derived locally by both sides. The signaling server never sees the AES key —
 *   it only ever sees two EC public points, from which the shared secret is
 *   computationally infeasible to recover (ECDH DLP).
 *
 * Encryption (AES-GCM-256):
 *   Each encrypt() call uses a fresh 96-bit random IV — reuse is impossible.
 *   The authentication tag covers both ciphertext and header, giving
 *   confidentiality + integrity in one pass. The full frame (header + payload)
 *   is encrypted together so no metadata leaks to a TURN relay.
 *
 * Forward secrecy: the ECDH private key is non-extractable and ephemeral —
 * a new pair is generated for every peer connection. Compromise of a past
 * session key does not expose any other session.
 */

const IV_BYTES = 12; // 96-bit IV required by AES-GCM

// ─── ECDH key agreement ───────────────────────────────────────────────────────

export async function generateEcdhPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // private key is non-extractable — cannot be leaked even via XSS
    ['deriveKey'],
  );
}

export async function exportEcdhPublicKey(pair: CryptoKeyPair): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey);
  const bytes = new Uint8Array(raw as ArrayBuffer);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function deriveAesKey(myPair: CryptoKeyPair, theirPublicB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(theirPublicB64), (c) => c.charCodeAt(0));
  const theirPublicKey = await crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false, // AES session key also non-extractable
    ['encrypt', 'decrypt'],
  );
}

// ─── Symmetric encryption ─────────────────────────────────────────────────────

export async function encrypt(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const buf = toArrayBuffer(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf);
  const out = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), IV_BYTES);
  return out;
}

export async function decrypt(key: CryptoKey, frame: Uint8Array): Promise<Uint8Array> {
  const ivBuf = toArrayBuffer(frame.slice(0, IV_BYTES));
  const ctBuf = toArrayBuffer(frame.slice(IV_BYTES));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, ctBuf);
  return new Uint8Array(plain);
}

function toArrayBuffer(src: Uint8Array): ArrayBuffer {
  return src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) as ArrayBuffer;
}
