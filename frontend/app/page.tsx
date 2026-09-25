'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { generateRoomCode } from '@/lib/room-code';
import { SignalingClient } from '@/lib/signaling-client';
import { ZapitPeer } from '@/lib/webrtc/peer-connection';
import { pickSaveDirectory, isFileSystemAccessSupported } from '@/lib/webrtc/disk-writer';
import { NavBar } from '@/components/NavBar';
import { LandingScreen } from '@/components/LandingScreen';
import { DiscoveryScreen } from '@/components/DiscoveryScreen';
import { ConnectedScreen } from '@/components/ConnectedScreen';
import { TransferScreen } from '@/components/TransferScreen';
import { AppFooter } from '@/components/AppFooter';
import type { TurnCredentials } from '@/lib/webrtc/peer-connection';
import type { TransferProgress, ReceivedResult } from '@/lib/webrtc/transfer-engine';

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL ?? 'ws://localhost:8787';

type ConnectionStatus = 'idle' | 'waiting' | 'connecting' | 'connected' | 'disconnected';

interface NearbyDevice {
  id: string;
  roomCode: string | null;
}

export default function HomePage() {
  const [roomCode, setRoomCode]             = useState('');
  const [shareUrl, setShareUrl]             = useState('');
  const [status, setStatus]                 = useState<ConnectionStatus>('idle');
  const [statusMsg, setStatusMsg]           = useState('');
  const [nearbyDevices, setNearbyDevices]   = useState<NearbyDevice[]>([]);
  const [transfers, setTransfers]           = useState<TransferProgress[]>([]);
  const [receivedFiles, setReceivedFiles]   = useState<ReceivedResult[]>([]);
  const [hasStarted, setHasStarted]         = useState(false);
  const [saveDirName, setSaveDirName]       = useState<string | null>(null);
  const [safetyNumber, setSafetyNumber]     = useState<string | null>(null);
  const [safetyVerified, setSafetyVerified] = useState(false);

  const sigRef        = useRef<SignalingClient | null>(null);
  const peerRef       = useRef<ZapitPeer | null>(null);
  const turnCredsRef  = useRef<TurnCredentials | null>(null);
  const myClientIdRef = useRef<string | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const saveDirRef     = useRef<FileSystemDirectoryHandle | null>(null);

  const updateTransfer = useCallback((p: TransferProgress) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.transferIndex === p.transferIndex);
      if (idx === -1) return [...prev, p];
      const next = [...prev];
      next[idx] = p;
      return next;
    });
  }, []);

  const handleFileReceived = useCallback((result: ReceivedResult) => {
    setReceivedFiles((prev) => [result, ...prev]);
  }, []);

  const handleChooseSaveFolder = useCallback(async () => {
    const dir = await pickSaveDirectory();
    if (!dir) return;
    saveDirRef.current = dir;
    setSaveDirName(dir.name);
  }, []);

  const connectToPeer = useCallback(
    async (peerId: string, role: 'offerer' | 'answerer') => {
      if (!sigRef.current) return;
      peerRef.current?.close();
      setSafetyNumber(null);
      setSafetyVerified(false);

      const peer = new ZapitPeer(sigRef.current, peerId, role, turnCredsRef.current, {
        onProgress:        updateTransfer,
        onFileReceived:    handleFileReceived,
        onError:           (msg) => setStatusMsg(msg),
        getSaveDirectory:  () => saveDirRef.current,
        onSafetyNumber:    (sn) => setSafetyNumber(sn),
        onStateChange:  (state) => {
          // Guard against stale callbacks from a superseded peer (e.g. peer1 fires
          // 'closed' after connectToPeer replaced it with peer2).
          if (peerRef.current !== peer) return;
          if (state === 'connected') setStatus('connected');
          if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            setStatus('disconnected');
            setStatusMsg('Peer disconnected');
          }
        },
      });
      peerRef.current = peer;

      if (role === 'offerer') {
        setStatus('connecting');
        await peer.initiate();
      }
    },
    [updateTransfer, handleFileReceived],
  );

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    setShareUrl(`${window.location.origin}?join=${code}`);

    const sig = new SignalingClient(SIGNALING_URL);
    sigRef.current = sig;

    // Auto-start if ?join= param present
    const params    = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (joinParam) {
      activeRoomRef.current = joinParam;
      setRoomCode(joinParam);
      setShareUrl(`${window.location.origin}?join=${joinParam}`);
      setHasStarted(true);
    }

    const unsub = sig.on(async (event) => {
      switch (event.type) {
        case 'connected': {
          setStatus('waiting');
          setStatusMsg('');
          // Rejoin active room on (re)connect
          if (activeRoomRef.current) sig.joinRoom(activeRoomRef.current);
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

        case 'peer-joined': {
          const myId      = myClientIdRef.current;
          const amOfferer = myId !== null && myId < event.peerId;
          await connectToPeer(event.peerId, amOfferer ? 'offerer' : 'answerer');
          break;
        }

        case 'offer': {
          await connectToPeer(event.from, 'answerer');
          const peer = peerRef.current;
          if (peer) await peer.handleOffer(event.payload);
          break;
        }

        case 'answer':
          await peerRef.current?.handleAnswer(event.payload);
          break;

        case 'ice-candidate':
          await peerRef.current?.handleIceCandidate(event.payload);
          break;

        case 'peer-left':
          setStatus('disconnected');
          setStatusMsg('Peer left the room');
          peerRef.current?.close();
          peerRef.current = null;
          setTransfers([]);
          setReceivedFiles([]);
          setSafetyNumber(null);
          setSafetyVerified(false);
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
      peerRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── User-action handlers ──────────────────────────────────────────────────

  const handleCreateRoom = useCallback(() => {
    if (!sigRef.current || !roomCode) return;
    activeRoomRef.current = roomCode;
    setHasStarted(true);
    sigRef.current.joinRoom(roomCode);
  }, [roomCode]);

  const handleJoinRoom = useCallback(() => {
    // Transition to Discovery so user can enter a code
    if (!hasStarted && sigRef.current && roomCode) {
      activeRoomRef.current = roomCode;
      sigRef.current.joinRoom(roomCode);
    }
    setHasStarted(true);
  }, [hasStarted, roomCode]);

  const handleJoinCode = useCallback((code: string) => {
    if (!sigRef.current) return;
    activeRoomRef.current = code;
    setRoomCode(code);
    setShareUrl(`${window.location.origin}?join=${code}`);
    setHasStarted(true);
    sigRef.current.leaveRoom();
    sigRef.current.joinRoom(code);
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

  const handleFiles = useCallback(async (files: File[]): Promise<void> => {
    if (!peerRef.current) throw new Error('Not connected to a peer');
    await peerRef.current.sendFiles(files);
  }, []);

  const handleDisconnect = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    sigRef.current?.leaveRoom();
    activeRoomRef.current = null;
    setStatus('disconnected');
    setStatusMsg('');
    setTransfers([]);
    setReceivedFiles([]);
    setSafetyNumber(null);
    setSafetyVerified(false);
  }, []);

  // ── Screen selection ──────────────────────────────────────────────────────

  const hasActiveTransfer = transfers.some((t) => !t.done) || receivedFiles.length > 0;
  const isConnected       = status === 'connected';
  const isTransferring    = isConnected && hasActiveTransfer;

  let screen: 'landing' | 'discovery' | 'connected' | 'transferring';
  if (!hasStarted) {
    screen = 'landing';
  } else if (isConnected && isTransferring) {
    screen = 'transferring';
  } else if (isConnected) {
    screen = 'connected';
  } else {
    screen = 'discovery';
  }

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

      {screen === 'connected' && (
        <ConnectedScreen
          onSend={handleFiles}
          saveDirName={saveDirName}
          onChooseSaveFolder={isFileSystemAccessSupported() ? handleChooseSaveFolder : undefined}
          safetyNumber={safetyNumber}
          safetyVerified={safetyVerified}
          onVerifySafety={() => setSafetyVerified(true)}
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
