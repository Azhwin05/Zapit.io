// Server-only LAN IP detection (Node's `os` module — never imported by
// client code). Same physical/virtual adapter heuristic used by
// desktop/main.js and host/start.mjs, kept in sync manually since this
// package doesn't share a workspace with those.
import { networkInterfaces } from 'node:os';

const VIRTUAL_ADAPTER_PATTERN = /docker|vethernet|virtualbox|vmware|hyper-v|wsl|loopback|tailscale|zerotier|tun|tap/i;
const PHYSICAL_ADAPTER_PATTERN = /wi-?fi|ethernet|^en\d|^eth\d|^wlan\d/i;

export function getLanIp(): string | null {
  const nets = networkInterfaces();
  const candidates: { name: string; address: string }[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push({ name, address: net.address });
    }
  }

  const physical = candidates.find((c) => PHYSICAL_ADAPTER_PATTERN.test(c.name) && !VIRTUAL_ADAPTER_PATTERN.test(c.name));
  if (physical) return physical.address;

  const nonVirtual = candidates.find((c) => !VIRTUAL_ADAPTER_PATTERN.test(c.name));
  if (nonVirtual) return nonVirtual.address;

  return candidates[0]?.address ?? null;
}
