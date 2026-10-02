// Custom production server for Zapit's frontend.
//
// Why this exists: `next start` serves HTTP only. For LAN self-hosting, guest
// devices load the app over the network at the host's IP — a NON-secure
// origin — where browsers make `window.crypto.subtle` (our whole ECDH/AES
// layer) UNDEFINED. A secure context requires HTTPS (or localhost). So when
// the launcher/desktop app passes a TLS cert, we serve HTTPS; otherwise we
// fall back to plain HTTP (e.g. behind Vercel's own TLS, or for localhost).
//
// Next's middleware (the per-request nonce CSP in middleware.ts) runs inside
// getRequestHandler(), so it is fully preserved here — no CSP rewrite needed.

import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import next from 'next';

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
const certFile = process.env.TLS_CERT_FILE;
const keyFile = process.env.TLS_KEY_FILE;
const useTls = Boolean(certFile && keyFile);

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const listener = (req, res) => {
  handle(req, res).catch((err) => {
    console.error('request handler error', err);
    res.statusCode = 500;
    res.end('internal server error');
  });
};

const server = useTls
  ? createHttpsServer({ cert: readFileSync(certFile), key: readFileSync(keyFile) }, listener)
  : createHttpServer(listener);

server.listen(port, hostname, () => {
  const scheme = useTls ? 'https' : 'http';
  console.log(`zapit-frontend ready on ${scheme}://${hostname}:${port}`);
});
