'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { generateRoomCode } from '@/lib/room-code';
import { SignalingClient } from '@/lib/signaling-client';
import { ZapitPeer } from '@/lib/webrtc/peer-connection';
import { pickSaveDirectory, isFileSystemAccessSupported } from '@/lib/webrtc/disk-writer';
import { peerLabel } from '@/lib/peer-label';
import { readSharedFiles } from '@/lib/share-target';
import { resolveSignalingUrl, setSignalingUrlOverride, isValidSignalingUrl } from '@/lib/signaling-url';
import { getDeviceName } from '@/lib/device-name';
import type { PublicRoom } from '@/lib/signaling-client';
import { NavBar } from '@/components/NavBar';
import { LandingScreen } from '@/components/LandingScreen';
import { DiscoveryScreen } from '@/components/DiscoveryScreen';
import { JoiningScreen } from '@/components/JoiningScreen';
import { ConnectedScreen } from '@/components/ConnectedScreen';
import { TransferScreen } from '@/components/TransferScreen';
import { AppFooter } from '@/components/AppFooter';
import type { TurnCredentials } from '@/lib/webrtc/peer-connection';
import type { TransferProgress, ReceivedResult, PendingTransfer } from '@/lib/webrtc/transfer-engine';

type ConnectionStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected';

interface NearbyDevice {
  id: string;
  roomCode: string | null;
}

// A room can hold several peers (see signaling-server's MAX_PEERS_PER_ROOM) —
// full mesh, every browser connects directly to every other browser. State
// that used to be single-peer (one transfer list, one safety number) is now
// keyed by peerId so it can't collide across simultaneous connections.
// transferIndex alone isn't unique across peers — it's only scoped to one
// sender's sendFiles() call — so UI state pairs it with peerId.

export default function HomePage() {
  const [roomCode, setRoomCode]             = useState('');
  const [shareUrl, setShareUrl]             = useState('');
  // window.location.origin is "localhost" whenever this device is the one
  // hosting the page — correct for that device's own browser, but useless
  // in a QR code, since "localhost" on the SCANNING phone means the phone
  // itself, not this machine. /api/lan-ip asks the Next.js server (a real
  // Node process) for this machine's actual LAN address, same heuristic
  // used by desktop/main.js and host/start.mjs, so links/QRs work when
  // just running `npm run dev` too.
  const [lanOrigin, setLanOrigin]           = useState<string | null>(null);
  const [status, setStatus]                 = useState<ConnectionStatus>('idle');
  const [statusMsg, setStatusMsg]           = useState('');
  const [nearbyDevices, setNearbyDevices]   = useState<NearbyDevice[]>([]);
  const [connectedPeerIds, setConnectedPeerIds] = useState<string[]>([]);
  const [transfers, setTransfers]           = useState<(TransferProgress & { peerId: string })[]>([]);
  const [receivedFiles, setReceivedFiles]   = useState<(ReceivedResult & { peerId: string })[]>([]);
  const [hasStarted, setHasStarted]         = useState(false);
  // LAN room browser: populated only when connected to a LAN-mode signaling
  // server (it pushes `rooms-updated`; a public cloud server never does, so
  // `lanMode` stays false and the browser UI never shows). Lets a device see
  // every active room on the network and click to join — no code typing.
  const [lanRooms, setLanRooms]             = useState<PublicRoom[]>([]);
  const [lanMode, setLanMode]               = useState(false);
  // Distinguishes "I created this room, show my code for others to scan" from
  // "I'm joining someone else's room" — both used to render the same
  // DiscoveryScreen (your own room code + QR), which is actively misleading
  // when you arrived via someone ELSE's join link/QR: you'd see your OWN
  // fresh room code instead of any indication you're connecting to the room
  // you actually meant to join. Reported live: scanning a join QR on a phone
  // showed "the same page as the laptop" instead of progressing anywhere.
  const [isHost, setIsHost]                 = useState(true);
  const [saveDirName, setSaveDirName]       = useState<string | null>(null);
  const [safetyNumbers, setSafetyNumbers]   = useState<Record<string, string>>({});
  const [safetyVerified, setSafetyVerified] = useState<Record<string, boolean>>({});
  // Files handed off from the OS share sheet (Android/Chrome PWA only — see
  // sw.js's Web Share Target handler). Pre-staged into ConnectedScreen once
  // a peer connects; the user still has to create/join a room first, since
  // there's no destination to send to yet.
  const [sharedFiles, setSharedFiles]       = useState<File[]>([]);

  const sigRef        = useRef<SignalingClient | null>(null);
  const peersRef       = useRef<Map<string, ZapitPeer>>(new Map());
  const turnCredsRef  = useRef<TurnCredentials | null>(null);
  const myClientIdRef = useRef<string | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const saveDirRef     = useRef<FileSystemDirectoryHandle | null>(null);
  // Per-peerId resume state — see PeerConnectionCallbacks.getResumeCache doc
  // for exactly what this does and doesn't survive (same-peerId renegotiation
  // only, not a full signaling reconnect, which always gets a new peerId).
  const resumeCachesRef = useRef<Map<string, Map<number, PendingTransfer>>>(new Map());

  const updateTransfer = useCallback((peerId: string, p: TransferProgress) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.peerId === peerId && t.transferIndex === p.transferIndex);
      if (idx === -1) return [...prev, { ...p, peerId }];
      const next = [...prev];
      next[idx] = { ...p, peerId };
      return next;
    });
  }, []);

  const handleFileReceived = useCallback((peerId: string, result: ReceivedResult) => {
    setReceivedFiles((prev) => [{ ...result, peerId }, ...prev]);
  }, []);

  const handleChooseSaveFolder = useCallback(async () => {
    const dir = await pickSaveDirectory();
    if (!dir) return;
    saveDirRef.current = dir;
    setSaveDirName(dir.name);
  }, []);

  const removePeer = useCallback((peerId: string) => {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    // A real disconnect always gets a new peerId on reconnect (the signaling
    // server assigns a fresh clientId per connection), so a departed peerId's
    // resume cache will never be matched again — drop it rather than leak it.
    resumeCachesRef.current.delete(peerId);
    setConnectedPeerIds((prev) => prev.filter((id) => id !== peerId));
    setTransfers((prev) => prev.filter((t) => t.peerId !== peerId));
    setReceivedFiles((prev) => prev.filter((r) => r.peerId !== peerId));
    setSafetyNumbers((prev) => { const n = { ...prev }; delete n[peerId]; return n; });
    setSafetyVerified((prev) => { const n = { ...prev }; delete n[peerId]; return n; });
  }, []);

  const connectToPeer = useCallback(
    async (peerId: string, role: 'offerer' | 'answerer') => {
      if (!sigRef.current) return;
      // Reconnecting to the same peerId (rare — e.g. a stale offer race, or an
      // app-level retry after a channel-level failure while the signaling
      // connection stayed up) replaces the existing link for that peer only;
      // other peers are untouched. The resume cache is kept (not cleared)
      // across this replacement, which is exactly what lets a resumed
      // transfer skip chunks the receiver already has.
      peersRef.current.get(peerId)?.close();

      const peer = new ZapitPeer(sigRef.current, peerId, role, turnCredsRef.current, {
        onProgress:        (p) => updateTransfer(peerId, p),
        onFileReceived:    (r) => handleFileReceived(peerId, r),
        onError:           (msg) => setStatusMsg(msg),
        getSaveDirectory:  () => saveDirRef.current,
        getResumeCache:    () => {
          let cache = resumeCachesRef.current.get(peerId);
          if (!cache) { cache = new Map(); resumeCachesRef.current.set(peerId, cache); }
          return cache;
        },
        onSafetyNumber:    (sn) => setSafetyNumbers((prev) => ({ ...prev, [peerId]: sn })),
        onStateChange:  (state) => {
          // Guard against stale callbacks from a superseded connection to this peerId.
          if (peersRef.current.get(peerId) !== peer) return;
          if (state === 'connected') {
            setStatus('connected');
            setConnectedPeerIds((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]));
          }
          if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            removePeer(peerId);
            setStatusMsg('A peer disconnected');
          }
        },
      });
      peersRef.current.set(peerId, peer);

      if (role === 'offerer') {
        setStatus('connecting');
        await peer.initiate();
      }
    },
    [updateTransfer, handleFileReceived, removePeer],
  );

  // Only relevant when this page is being viewed via localhost/127.0.0.1
  // (i.e. no reverse proxy/real domain already in front of it) — skips the
  // extra request entirely for normal hosted deployments.
  useEffect(() => {
    const { protocol, hostname, port } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return;
    fetch('/api/lan-ip')
      .then((res) => res.json())
      .then((data: { ip: string | null }) => {
        if (data.ip) setLanOrigin(`${protocol}//${data.ip}${port ? `:${port}` : ''}`);
      })
      .catch(() => {});
  }, []);

  // Re-point the share link/QR at the LAN address as soon as it's known,
  // whichever room code is currently active (own room or a joined one).
  useEffect(() => {
    if (!lanOrigin || !roomCode) return;
    setShareUrl(`${lanOrigin}?join=${roomCode}`);
  }, [lanOrigin, roomCode]);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    setShareUrl(`${window.location.origin}?join=${code}`);

    const params = new URLSearchParams(window.location.search);

    // LAN mode via shareable link (e.g. from a QR code shown by someone
    // running their own signaling server): ?signaling=ws://192.168.x.x:8787
    // persists as the same override the settings panel writes (lib/signaling-url.ts),
    // so it's remembered on this device beyond just this page load.
    //
    // The matching CSP relaxation (middleware.ts) is cookie-gated, and CSP is
    // fixed for the lifetime of a response — setting the cookie via client JS
    // can't retroactively loosen the policy this document already received.
    // So on the very first visit via this link we set the override, then
    // reload once so the *next* request carries the cookie and gets the
    // relaxed CSP before we ever try to open the WebSocket.
    const signalingParam = params.get('signaling');
    const alreadyOptedIn = document.cookie.includes('zapit-custom-signaling=1');
    if (signalingParam && isValidSignalingUrl(signalingParam) && !alreadyOptedIn) {
      setSignalingUrlOverride(signalingParam);
      window.location.reload();
      return;
    }
    if (signalingParam && isValidSignalingUrl(signalingParam)) {
      setSignalingUrlOverride(signalingParam);
      const url = new URL(window.location.href);
      url.searchParams.delete('signaling');
      window.history.replaceState({}, '', url.toString());
    }

    const sig = new SignalingClient(resolveSignalingUrl());
    sigRef.current = sig;

    // Auto-start if ?join= param present
    const joinParam = params.get('join');
    if (joinParam) {
      activeRoomRef.current = joinParam;
      setRoomCode(joinParam);
      setShareUrl(`${window.location.origin}?join=${joinParam}`);
      setHasStarted(true);
      setIsHost(false);
    }

    // Files handed off from the OS share sheet (see sw.js's Web Share Target
    // handler) land here as ?shared=<sessionId>. Read them back once, then
    // scrub the param so a refresh doesn't try to re-read an already-consumed
    // (and by then deleted) cache entry.
    const sharedParam = params.get('shared');
    if (sharedParam) {
      readSharedFiles(sharedParam).then((files) => {
        if (files.length > 0) setSharedFiles(files);
      });
      const url = new URL(window.location.href);
      url.searchParams.delete('shared');
      window.history.replaceState({}, '', url.toString());
    }

    const unsub = sig.on(async (event) => {
      switch (event.type) {
        case 'connected': {
          setStatus('waiting');
          setStatusMsg('');
          // Rejoin active room on (re)connect, carrying our device name so the
          // room browser keeps showing us correctly after a reconnect.
          if (activeRoomRef.current) sig.joinRoom(activeRoomRef.current, { name: getDeviceName() });
          break;
        }

        case 'disconnected':
          setStatus('idle');
          setStatusMsg('Reconnecting to signaling server…');
          break;

        case 'joined':
          myClientIdRef.current = event.clientId;
          setStatus('waiting');
          break;

        case 'turn-credentials':
          turnCredsRef.current = event.payload;
          break;

        case 'nearby-devices':
          setNearbyDevices((prev) => {
            const ids = new Set(prev.map((d) => d.id));
            const newDevices = event.payload.filter((d) => !ids.has(d.id));
            return [...prev, ...newDevices];
          });
          break;

        case 'rooms-updated':
          // Only a LAN-mode server sends this, so its arrival is itself the
          // signal that the room browser should be available.
          setLanMode(true);
          setLanRooms(event.payload);
          break;

        case 'peer-joined': {
          const myId      = myClientIdRef.current;
          const amOfferer = myId !== null && myId < event.peerId;
          await connectToPeer(event.peerId, amOfferer ? 'offerer' : 'answerer');
          break;
        }

        case 'offer': {
          await connectToPeer(event.from, 'answerer');
          const peer = peersRef.current.get(event.from);
          if (peer) await peer.handleOffer(event.payload);
          break;
        }

        case 'answer':
          await peersRef.current.get(event.from)?.handleAnswer(event.payload);
          break;

        case 'ice-candidate':
          await peersRef.current.get(event.from)?.handleIceCandidate(event.payload);
          break;

        case 'peer-left':
          removePeer(event.peerId);
          setStatusMsg('Peer left the room');
          setStatus((s) => (peersRef.current.size > 0 ? s : 'disconnected'));
          break;

        case 'room-full':
          setStatusMsg('Room is full — try a new code');
          break;

        case 'error':
          setStatusMsg(`Error: ${event.payload}`);
          break;
      }
    });

    sig.connect();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    return () => {
      unsub();
      sig.destroy();
      for (const peer of Array.from(peersRef.current.values())) peer.close();
      peersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── User-action handlers ──────────────────────────────────────────────────

  const handleCreateRoom = useCallback((roomName?: string) => {
    if (!sigRef.current || !roomCode) return;
    activeRoomRef.current = roomCode;
    setHasStarted(true);
    setIsHost(true);
    sigRef.current.joinRoom(roomCode, { name: getDeviceName(), roomName });
  }, [roomCode]);

  const handleJoinRoom = useCallback(() => {
    // Transition to Discovery so user can enter a code
    if (!hasStarted && sigRef.current && roomCode) {
      activeRoomRef.current = roomCode;
      sigRef.current.joinRoom(roomCode, { name: getDeviceName() });
    }
    setHasStarted(true);
  }, [hasStarted, roomCode]);

  const handleJoinCode = useCallback((code: string) => {
    if (!sigRef.current) return;
    activeRoomRef.current = code;
    setRoomCode(code);
    setShareUrl(`${window.location.origin}?join=${code}`);
    setHasStarted(true);
    setIsHost(false);
    sigRef.current.leaveRoom();
    sigRef.current.joinRoom(code, { name: getDeviceName() });
    setStatus('waiting');
    setStatusMsg('');
  }, []);

  const handleNearbyConnect = useCallback((device: NearbyDevice) => {
    if (!sigRef.current || !myClientIdRef.current) return;
    // The signaling server only relays offers between clients in the same room.
    // If the nearby device has a room code, join it so the server can relay.
    // The server will then send peer-joined to both sides, triggering WebRTC automatically.
    if (device.roomCode && device.roomCode !== activeRoomRef.current) {
      handleJoinCode(device.roomCode);
      return;
    }
    // Already in the same room (or no room code available) — direct connect.
    const amOfferer = myClientIdRef.current < device.id;
    connectToPeer(device.id, amOfferer ? 'offerer' : 'answerer');
  }, [connectToPeer, handleJoinCode]);

  // Broadcasts to every connected peer — matches the AirDrop-style expectation
  // that dropping a file sends it to everyone in the room, not just one pick.
  const handleFiles = useCallback(async (files: File[]): Promise<void> => {
    const peers = Array.from(peersRef.current.values());
    if (peers.length === 0) throw new Error('Not connected to a peer');
    const results = await Promise.allSettled(peers.map((p) => p.sendFiles(files)));
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length) {
      throw new Error('Failed to send to all connected peers');
    }
  }, []);

  const handleSendText = useCallback(async (text: string): Promise<void> => {
    const peers = Array.from(peersRef.current.values());
    if (peers.length === 0) throw new Error('Not connected to a peer');
    const results = await Promise.allSettled(peers.map((p) => p.sendText(text)));
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length) {
      throw new Error('Failed to send to all connected peers');
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    for (const peer of Array.from(peersRef.current.values())) peer.close();
    peersRef.current.clear();
    resumeCachesRef.current.clear();
    sigRef.current?.leaveRoom();
    activeRoomRef.current = null;
    setStatus('disconnected');
    setStatusMsg('');
    setConnectedPeerIds([]);
    setTransfers([]);
    setReceivedFiles([]);
    setSafetyNumbers({});
    setSafetyVerified({});
  }, []);

  // ── Screen selection ──────────────────────────────────────────────────────

  const hasActiveTransfer = transfers.some((t) => !t.done) || receivedFiles.length > 0;
  const isConnected       = status === 'connected' && connectedPeerIds.length > 0;
  const isTransferring    = isConnected && hasActiveTransfer;

  let screen: 'landing' | 'discovery' | 'joining' | 'connected' | 'transferring';
  if (!hasStarted) {
    screen = 'landing';
  } else if (isConnected && isTransferring) {
    screen = 'transferring';
  } else if (isConnected) {
    screen = 'connected';
  } else if (isHost) {
    screen = 'discovery';
  } else {
    // Joined via a link/QR/typed code — waiting on the WebRTC handshake to
    // complete. Never shows DiscoveryScreen's own-room-code/QR here: seeing
    // your OWN code while trying to join someone ELSE's room is exactly the
    // confusing state that was reported.
    screen = 'joining';
  }

  const safetyList = connectedPeerIds
    .filter((id) => safetyNumbers[id])
    .map((id) => ({
      peerId:       id,
      peerLabel:    peerLabel(id),
      safetyNumber: safetyNumbers[id],
      verified:     !!safetyVerified[id],
    }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar
        roomCode={hasStarted && roomCode ? roomCode : null}
        onDisconnect={isConnected ? handleDisconnect : undefined}
      />

      {screen === 'landing' && (
        <LandingScreen
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          connecting={status === 'idle'}
          lanRooms={lanRooms}
          onJoinCode={handleJoinCode}
        />
      )}

      {screen === 'discovery' && (
        <DiscoveryScreen
          roomCode={roomCode}
          shareUrl={shareUrl}
          status={status}
          statusMsg={statusMsg}
          nearbyDevices={nearbyDevices}
          onNearbyConnect={handleNearbyConnect}
          onJoinCode={handleJoinCode}
        />
      )}

      {screen === 'joining' && (
        <JoiningScreen roomCode={roomCode} status={status} statusMsg={statusMsg} />
      )}

      {screen === 'connected' && (
        <ConnectedScreen
          onSend={handleFiles}
          onSendText={handleSendText}
          connectedPeerIds={connectedPeerIds}
          saveDirName={saveDirName}
          onChooseSaveFolder={isFileSystemAccessSupported() ? handleChooseSaveFolder : undefined}
          safetyList={safetyList}
          onVerifySafety={(peerId) => setSafetyVerified((prev) => ({ ...prev, [peerId]: true }))}
          initialFiles={sharedFiles}
          onInitialFilesConsumed={() => setSharedFiles([])}
        />
      )}

      {screen === 'transferring' && (
        <TransferScreen
          transfers={transfers}
          receivedFiles={receivedFiles}
          roomCode={roomCode}
        />
      )}

      <AppFooter minimal={isConnected} />
    </div>
  );
}
