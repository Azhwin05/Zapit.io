// Self-signed TLS cert for LAN HTTPS — desktop app copy.
//
// Mirror of host/cert.mjs (kept as a separate copy because the packaged
// desktop app ships without the repo's host/ directory). Guest devices load
// the app at this machine's LAN IP, which is a non-secure origin over http://
// — and browsers make window.crypto.subtle undefined there, killing the whole
// encryption layer. HTTPS fixes it (a secure context), at the cost of a
// one-time "not trusted" warning on guest devices (the cert is self-signed;
// there's no CA for a random LAN IP). The desktop host's OWN window never sees
// that warning: it loads https://localhost and main.js trusts this exact cert
// via setCertificateVerifyProc. We generate one cert covering localhost +
// 127.0.0.1 + the current LAN IP and cache it so each guest accepts it once.

import selfsigned from 'selfsigned';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Returns { certFile, keyFile } absolute paths, (re)generating the cert if it
// doesn't yet cover `lanIp`. cacheDir is where the PEMs are written.
export async function ensureCert(cacheDir, lanIp) {
  mkdirSync(cacheDir, { recursive: true });
  const certFile = path.join(cacheDir, 'zapit-cert.pem');
  const keyFile = path.join(cacheDir, 'zapit-key.pem');
  const metaFile = path.join(cacheDir, 'zapit-cert.meta');

  // Reuse a cached cert only if it was issued for this same LAN IP — the IP
  // is baked into the cert's SAN list, so a changed network needs a new cert.
  const wantMeta = lanIp ?? 'no-lan';
  if (existsSync(certFile) && existsSync(keyFile) && existsSync(metaFile)) {
    try {
      if (readFileSync(metaFile, 'utf8').trim() === wantMeta) return { certFile, keyFile };
    } catch {
      // fall through and regenerate
    }
  }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
  ];
  if (lanIp) altNames.push({ type: 7, ip: lanIp });

  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: lanIp ?? 'localhost' }],
    {
      days: 3650,
      keyType: 'rsa',
      algorithm: 'sha256',
      extensions: [{ name: 'subjectAltName', altNames }],
    },
  );

  writeFileSync(certFile, pems.cert);
  writeFileSync(keyFile, pems.private);
  writeFileSync(metaFile, wantMeta);
  return { certFile, keyFile };
}
