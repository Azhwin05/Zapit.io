import { describe, it, expect, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import {
  canAddClient, addClient, removeClient, getClient, getNearbyClients,
  joinRoom, leaveRoom, getRoom, getStats, touchRoom, __resetForTests,
  getPublicRoomList, getAllClients,
} from './room-manager';
import type { Client } from './types';

function makeClient(id: string, publicIp: string, joinedAt = Date.now()): Client {
  return { ws: {} as WebSocket, roomCode: null, publicIp, id, joinedAt };
}

beforeEach(() => {
  __resetForTests();
});

describe('canAddClient / addClient / removeClient', () => {
  it('allows a fresh IP under the per-IP cap', () => {
    expect(canAddClient('1.2.3.4')).toEqual({ ok: true });
  });

  it('rejects once an IP hits the per-IP cap (10)', () => {
    for (let i = 0; i < 10; i++) addClient(makeClient(`c${i}`, '1.2.3.4'));
    const result = canAddClient('1.2.3.4');
    expect(result.ok).toBe(false);
  });

  it('a different IP is unaffected by another IP being at its cap', () => {
    for (let i = 0; i < 10; i++) addClient(makeClient(`c${i}`, '1.2.3.4'));
    expect(canAddClient('5.6.7.8')).toEqual({ ok: true });
  });

  it('removeClient frees up the per-IP slot', () => {
    for (let i = 0; i < 10; i++) addClient(makeClient(`c${i}`, '1.2.3.4'));
    removeClient('c0');
    expect(canAddClient('1.2.3.4')).toEqual({ ok: true });
  });

  it('removeClient is a no-op for an unknown clientId (no throw)', () => {
    expect(() => removeClient('does-not-exist')).not.toThrow();
  });

  it('getClient returns undefined after removal', () => {
    addClient(makeClient('c1', '1.2.3.4'));
    removeClient('c1');
    expect(getClient('c1')).toBeUndefined();
  });

  it('rejects once the global cap (380) is hit, even from a fresh IP', () => {
    for (let i = 0; i < 380; i++) addClient(makeClient(`c${i}`, `10.0.0.${i % 250}`));
    expect(canAddClient('99.99.99.99').ok).toBe(false);
  });
});

describe('joinRoom / leaveRoom', () => {
  it('creates a room on first join and returns it', () => {
    const result = joinRoom(makeClient('c1', '1.2.3.4'), 'abc123');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.room.code).toBe('abc123');
  });

  it('sets client.roomCode on successful join', () => {
    const client = makeClient('c1', '1.2.3.4');
    joinRoom(client, 'abc123');
    expect(client.roomCode).toBe('abc123');
  });

  it('allows up to MAX_PEERS_PER_ROOM (6) clients in one room', () => {
    for (let i = 0; i < 6; i++) {
      const result = joinRoom(makeClient(`c${i}`, `1.2.3.${i}`), 'abc123');
      expect(result.ok).toBe(true);
    }
  });

  it('rejects the 7th client with reason "full"', () => {
    for (let i = 0; i < 6; i++) joinRoom(makeClient(`c${i}`, `1.2.3.${i}`), 'abc123');
    const result = joinRoom(makeClient('c7', '1.2.3.7'), 'abc123');
    expect(result).toEqual({ ok: false, reason: 'full' });
  });

  it('leaveRoom removes just the departing client, leaving others intact', () => {
    joinRoom(makeClient('c1', '1.2.3.4'), 'abc123');
    joinRoom(makeClient('c2', '1.2.3.5'), 'abc123');
    leaveRoom('c1', 'abc123');
    const room = getRoom('abc123');
    expect(room?.clients.size).toBe(1);
    expect(room?.clients.has('c2')).toBe(true);
  });

  it('leaveRoom deletes the room entirely once empty', () => {
    joinRoom(makeClient('c1', '1.2.3.4'), 'abc123');
    leaveRoom('c1', 'abc123');
    expect(getRoom('abc123')).toBeUndefined();
  });

  it('leaveRoom on an unknown room code is a no-op (no throw)', () => {
    expect(() => leaveRoom('c1', 'nope')).not.toThrow();
  });

  it('a departed client freeing a room slot lets a new client join', () => {
    for (let i = 0; i < 6; i++) joinRoom(makeClient(`c${i}`, `1.2.3.${i}`), 'abc123');
    leaveRoom('c0', 'abc123');
    const result = joinRoom(makeClient('c7', '1.2.3.7'), 'abc123');
    expect(result.ok).toBe(true);
  });

  it('touchRoom updates lastActivity without throwing on an unknown room', () => {
    expect(() => touchRoom('nope')).not.toThrow();
  });
});

describe('getNearbyClients — sliding discovery window', () => {
  it('two clients on the same IP within the window see each other', () => {
    const now = Date.now();
    addClient(makeClient('a', '1.2.3.4', now));
    addClient(makeClient('b', '1.2.3.4', now + 5_000));
    expect(getNearbyClients('a').map((c) => c.id)).toEqual(['b']);
    expect(getNearbyClients('b').map((c) => c.id)).toEqual(['a']);
  });

  it('clients on different IPs never see each other', () => {
    const now = Date.now();
    addClient(makeClient('a', '1.2.3.4', now));
    addClient(makeClient('b', '5.6.7.8', now));
    expect(getNearbyClients('a')).toEqual([]);
  });

  it('a client outside the 30s window is not "nearby"', () => {
    const now = Date.now();
    addClient(makeClient('a', '1.2.3.4', now));
    addClient(makeClient('b', '1.2.3.4', now + 31_000));
    expect(getNearbyClients('a')).toEqual([]);
  });

  it('is a sliding window per-device, not anchored to the first joiner (regression check for the bug fixed by A14)', () => {
    // C joins at t=35s, B joined at t=29s — 6s apart, well within the 30s
    // window relative to EACH OTHER, even though both are >30s after t=0.
    const t0 = Date.now();
    addClient(makeClient('a', '1.2.3.4', t0));
    addClient(makeClient('b', '1.2.3.4', t0 + 29_000));
    addClient(makeClient('c', '1.2.3.4', t0 + 35_000));
    expect(getNearbyClients('c').map((x) => x.id).sort()).toEqual(['b']);
  });

  it('returns empty for an unknown clientId', () => {
    expect(getNearbyClients('ghost')).toEqual([]);
  });
});

describe('getStats', () => {
  it('reflects current connection and room counts', () => {
    addClient(makeClient('a', '1.2.3.4'));
    addClient(makeClient('b', '5.6.7.8'));
    joinRoom(getClient('a')!, 'room1');
    expect(getStats()).toEqual({ connections: 2, rooms: 1 });
  });
});

describe('room names (LAN room browser)', () => {
  it('first namer wins; later joiners do not clobber the room name', () => {
    joinRoom(makeClient('c1', '1.2.3.4'), 'abc123', 'Design Team');
    joinRoom(makeClient('c2', '1.2.3.5'), 'abc123', 'Something Else');
    expect(getRoom('abc123')?.name).toBe('Design Team');
  });

  it('a room with no name given stays unnamed', () => {
    joinRoom(makeClient('c1', '1.2.3.4'), 'abc123');
    expect(getRoom('abc123')?.name).toBeUndefined();
  });

  it('caps an over-long room name at 40 chars', () => {
    joinRoom(makeClient('c1', '1.2.3.4'), 'abc123', 'x'.repeat(100));
    expect(getRoom('abc123')?.name?.length).toBe(40);
  });
});

describe('getPublicRoomList', () => {
  it('lists active rooms with code, name, peer count and device names', () => {
    const a = makeClient('a', '1.2.3.4'); a.name = 'Ashwin Laptop';
    const b = makeClient('b', '1.2.3.5'); b.name = 'Phone';
    addClient(a); addClient(b);
    joinRoom(a, 'abc123', 'Design Team');
    joinRoom(b, 'abc123');
    const list = getPublicRoomList();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ code: 'abc123', name: 'Design Team', peerCount: 2 });
    expect(list[0].deviceNames.sort()).toEqual(['Ashwin Laptop', 'Phone']);
  });

  it('falls back to "Device" when a client has no name', () => {
    const a = makeClient('a', '1.2.3.4');
    addClient(a);
    joinRoom(a, 'abc123');
    expect(getPublicRoomList()[0].deviceNames).toEqual(['Device']);
  });

  it('excludes empty rooms and reflects an emptied room disappearing', () => {
    const a = makeClient('a', '1.2.3.4');
    addClient(a);
    joinRoom(a, 'abc123');
    expect(getPublicRoomList()).toHaveLength(1);
    leaveRoom('a', 'abc123');
    expect(getPublicRoomList()).toHaveLength(0);
  });
});

describe('getAllClients', () => {
  it('returns every connected client regardless of room or IP', () => {
    addClient(makeClient('a', '1.2.3.4'));
    addClient(makeClient('b', '5.6.7.8'));
    expect(getAllClients().map((c) => c.id).sort()).toEqual(['a', 'b']);
  });
});
