// Short, stable, human-readable label for a peer's connection id. Zapit has
// no concept of device names, so this is the only identifier available.
export function peerLabel(peerId: string): string {
  return `Device ${peerId.slice(0, 6)}`;
}
