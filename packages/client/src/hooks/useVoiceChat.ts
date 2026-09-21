import { useEffect, useRef, useState } from 'react';
import { ClientEvents, Player, ServerEvents, VoiceSignalReceivedPayload } from '@werewolf/shared';
import { socket } from '../lib/socket';
import { audioManager } from '../lib/audio';

// STUN alone fails when both peers sit behind strict/symmetric NATs (common
// on corporate networks and some mobile carriers) — the TURN entry below
// relays audio in that case. This is openrelay.metered.ca's free public
// TURN server; credentials are shared/public and can change or rate-limit
// without notice. For a production deployment, replace with a paid/private
// TURN server for reliability.
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

interface PeerEntry {
  connection: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  outputGain: GainNode | null;
}

/**
 * Mesh WebRTC voice chat: one RTCPeerConnection per other connected
 * player, signaled through the existing socket connection (see
 * voiceHandlers.ts on the server — a pure SDP/ICE relay). Connections to
 * every current room member stay open regardless of `micEnabled`; muting
 * just disables the outgoing local track so listening keeps working.
 *
 * Uses a free public TURN server as fallback alongside STUN (see
 * ICE_SERVERS above) — improves connectivity across strict NATs but is not
 * guaranteed to be available long-term; swap in a private TURN server for
 * production.
 */
export function useVoiceChat(players: Player[], myPlayerId: string | null, micEnabled: boolean) {
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const rawMicStreamRef = useRef<MediaStream | null>(null); // raw hardware capture — must be .stop()'d to free the mic
  const outgoingStreamRef = useRef<MediaStream | null>(null); // post-gain stream actually sent to peers
  const micGainRef = useRef<GainNode | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [speakingPeerIds, setSpeakingPeerIds] = useState<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }

  function watchActivity(id: string, stream: MediaStream) {
    try {
      const ctx = getAudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analysersRef.current.set(id, analyser);
    } catch {
      /* AudioContext unavailable (e.g. no gesture yet) — activity indicator is cosmetic only */
    }
  }

  useEffect(() => {
    const data = new Uint8Array(256);
    const interval = setInterval(() => {
      const next = new Set<string>();
      analysersRef.current.forEach((analyser, id) => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 14) next.add(id);
      });
      if (!micEnabled && myPlayerId) next.delete(myPlayerId);
      setSpeakingPeerIds((prev) => {
        if (prev.size === next.size && [...prev].every((id) => next.has(id))) return prev;
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [micEnabled, myPlayerId]);


  function applyVolume(peerId: string) {
    const entry = peersRef.current.get(peerId);
    if (!entry?.outputGain) return;
    entry.outputGain.gain.value = audioManager.getMasterVolume() * audioManager.getPlayerVolume(peerId);
  }

  function applyAllVolumes() {
    peersRef.current.forEach((_, peerId) => applyVolume(peerId));
  }

  function applyMicGain() {
    if (micGainRef.current) micGainRef.current.gain.value = audioManager.getMicVolume();
  }

  async function ensureLocalStream(): Promise<MediaStream | null> {
    if (outgoingStreamRef.current) return outgoingStreamRef.current;
    try {
      const raw = await navigator.mediaDevices.getUserMedia({ audio: true });
      rawMicStreamRef.current = raw;
      const ctx = getAudioCtx();
      const source = ctx.createMediaStreamSource(raw);
      const gain = ctx.createGain();
      gain.gain.value = audioManager.getMicVolume();
      micGainRef.current = gain;
      const dest = ctx.createMediaStreamDestination();
      source.connect(gain).connect(dest);
      outgoingStreamRef.current = dest.stream;
      setMicError(null);
      if (myPlayerId) watchActivity(myPlayerId, raw);
      return dest.stream;
    } catch {
      setMicError('Không thể truy cập micro. Kiểm tra quyền trình duyệt.');
      return null;
    }
  }

  function closePeer(peerId: string) {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    entry.connection.close();
    entry.audioEl.pause();
    entry.audioEl.srcObject = null;
    entry.outputGain?.disconnect();
    peersRef.current.delete(peerId);
    analysersRef.current.delete(peerId);
  }

  async function createPeer(peerId: string, initiator: boolean): Promise<PeerEntry> {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const connection = new RTCPeerConnection(ICE_SERVERS);
    const audioEl = new Audio();
    audioEl.autoplay = true;
    const entry: PeerEntry = { connection, audioEl, outputGain: null };
    peersRef.current.set(peerId, entry);

    const stream = await ensureLocalStream();
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
      connection.addTrack(track, stream);
    });

    connection.ontrack = (e) => {
      const remoteStream = e.streams[0];
      // The <audio> element stays muted — it just keeps the inbound track
      // "alive" per browser autoplay quirks. Actual audible output runs
      // through the Web Audio graph below so we can apply a per-peer gain.
      audioEl.srcObject = remoteStream;
      audioEl.muted = true;
      audioEl.play().catch(() => {});
      try {
        const ctx = getAudioCtx();
        const source = ctx.createMediaStreamSource(remoteStream);
        const gain = ctx.createGain();
        gain.gain.value = audioManager.getMasterVolume() * audioManager.getPlayerVolume(peerId);
        source.connect(gain).connect(ctx.destination);
        entry.outputGain = gain;
      } catch {
        // Web Audio graph failed to build — fall back to plain element playback.
        audioEl.muted = false;
        audioEl.volume = audioManager.getMasterVolume() * audioManager.getPlayerVolume(peerId);
      }
      watchActivity(peerId, remoteStream);
    };

    connection.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit(ClientEvents.VOICE_ICE_CANDIDATE, { targetPlayerId: peerId, data: e.candidate.toJSON() });
      }
    };

    if (initiator) {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socket.emit(ClientEvents.VOICE_OFFER, { targetPlayerId: peerId, data: offer });
    }

    return entry;
  }

  // Open/close peer connections as room membership changes.
  useEffect(() => {
    if (!myPlayerId) return;
    const currentIds = new Set(players.filter((p) => p.id !== myPlayerId && p.isConnected).map((p) => p.id));

    for (const peerId of Array.from(peersRef.current.keys())) {
      if (!currentIds.has(peerId)) closePeer(peerId);
    }
    for (const peerId of currentIds) {
      if (!peersRef.current.has(peerId)) {
        // Lower id "calls" the higher id to avoid both sides offering at once.
        void createPeer(peerId, myPlayerId < peerId);
      }
    }
  }, [players, myPlayerId]);

  // Toggle the outgoing track on every open connection when mic is muted/unmuted.
  useEffect(() => {
    outgoingStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled;
    });
    if (micEnabled) void ensureLocalStream();
  }, [micEnabled]);

  // Incoming signaling.
  useEffect(() => {
    async function onOffer({ fromPlayerId, data }: VoiceSignalReceivedPayload) {
      const entry = await createPeer(fromPlayerId, false);
      await entry.connection.setRemoteDescription(data as RTCSessionDescriptionInit);
      const answer = await entry.connection.createAnswer();
      await entry.connection.setLocalDescription(answer);
      socket.emit(ClientEvents.VOICE_ANSWER, { targetPlayerId: fromPlayerId, data: answer });
    }
    async function onAnswer({ fromPlayerId, data }: VoiceSignalReceivedPayload) {
      const entry = peersRef.current.get(fromPlayerId);
      if (!entry) return;
      await entry.connection.setRemoteDescription(data as RTCSessionDescriptionInit);
    }
    async function onIce({ fromPlayerId, data }: VoiceSignalReceivedPayload) {
      const entry = peersRef.current.get(fromPlayerId);
      if (!entry) return;
      try {
        await entry.connection.addIceCandidate(data as RTCIceCandidateInit);
      } catch {
        /* candidate arrived before remote description; safe to ignore */
      }
    }
    function onPeerLeft({ playerId }: { playerId: string }) {
      closePeer(playerId);
    }

    socket.on(ServerEvents.VOICE_OFFER, onOffer);
    socket.on(ServerEvents.VOICE_ANSWER, onAnswer);
    socket.on(ServerEvents.VOICE_ICE_CANDIDATE, onIce);
    socket.on(ServerEvents.VOICE_PEER_LEFT, onPeerLeft);
    return () => {
      socket.off(ServerEvents.VOICE_OFFER, onOffer);
      socket.off(ServerEvents.VOICE_ANSWER, onAnswer);
      socket.off(ServerEvents.VOICE_ICE_CANDIDATE, onIce);
      socket.off(ServerEvents.VOICE_PEER_LEFT, onPeerLeft);
    };
  }, []);

  // Full teardown on unmount (leaving the room / closing the tab).
  useEffect(() => {
    return () => {
      peersRef.current.forEach((_, peerId) => closePeer(peerId));
      rawMicStreamRef.current?.getTracks().forEach((t) => t.stop());
      rawMicStreamRef.current = null;
      outgoingStreamRef.current = null;
      micGainRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  return { micError, applyVolume, applyAllVolumes, applyMicGain, speakingPeerIds };
}
