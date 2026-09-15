import { useEffect, useRef, useState } from 'react';
import { GamePhase } from '@werewolf/shared';
import { useGameDispatch, useGameState } from '../store/GameContext';
import { audioManager } from '../lib/audio';
import { MoonPhaseIndicator } from '../components/common/MoonPhaseIndicator';
import { PlayerCircle } from '../components/common/PlayerCircle';
import { RoleRevealModal } from '../components/game/RoleRevealModal';
import { RoleDealAnimation } from '../components/game/RoleDealAnimation';
import { NightActionPanel } from '../components/game/NightActionPanel';
import { ThiefChoiceModal } from '../components/game/ThiefChoiceModal';
import { MaidNightChoiceModal } from '../components/game/MaidNightChoiceModal';
import { DayRevealBanner } from '../components/game/DayRevealBanner';
import { DiscussionChat } from '../components/game/DiscussionChat';
import { VotingPanel } from '../components/game/VotingPanel';
import { MayorElectionPanel } from '../components/game/MayorElectionPanel';
import { ChiefSuccessorPrompt } from '../components/game/ChiefSuccessorPrompt';
import { HunterShotPanel } from '../components/game/HunterShotPanel';
import { GameOverScreen } from '../components/game/GameOverScreen';
import { InRoomSettingsPanel } from '../components/game/InRoomSettingsPanel';
import { useVoiceChat } from '../hooks/useVoiceChat';
import './RoomPage.css';

interface RoomPageProps {
  roomId: string;
  onLeaveRoom: () => void;
  onOpenCardGallery: () => void;
}

export function RoomPage({ roomId, onLeaveRoom, onOpenCardGallery }: RoomPageProps) {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const {
    roomState,
    myPlayerId,
    myRoleInfo,
    nightPrompt,
    lastDayReveal,
    voteTally,
    hunterPrompt,
    gameOver,
    chatMessages,
    errorMessage,
    thiefCards,
    maidPrompt,
    maidNightPrompt,
    chiefSuccessorPrompt,
    mayorElected,
  } = state;

  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [transition, setTransition] = useState<'day' | 'night' | null>(null);
  const [dealingCards, setDealingCards] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const me = roomState?.players.find((p) => p.id === myPlayerId) ?? null;
  const voiceChat = useVoiceChat(roomState?.players ?? [], myPlayerId, micEnabled && !!me?.isAlive);

  useEffect(() => {
    const last = chatMessages[chatMessages.length - 1];
    if (!last) return;
    setSpeakingId(last.playerId);
    const t = setTimeout(() => setSpeakingId(null), 1400);
    return () => clearTimeout(t);
  }, [chatMessages]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevPhaseRef = useRef(roomState?.phase);
  const lastDayRevealRef = useRef(lastDayReveal);
  const lastErrorRef = useRef(errorMessage);

  // Real countdown derived from server's phaseEndsAt timestamp.
  useEffect(() => {
    const endsAt = roomState?.phaseEndsAt ?? null;
    if (!endsAt) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [roomState?.phaseEndsAt]);

  // Chat auto-closes once discussion ends.
  useEffect(() => {
    if (roomState?.phase !== GamePhase.DISCUSSION) setShowChat(false);
  }, [roomState?.phase]);

  useEffect(() => {
    if (!mayorElected) return;
    const t = setTimeout(() => dispatch({ type: 'MAYOR_ELECTED', payload: null }), 4000);
    return () => clearTimeout(t);
  }, [mayorElected, dispatch]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    const cur = roomState?.phase;
    if (cur && cur !== prev) {
      if (cur === GamePhase.ROLE_ASSIGN) {
        setDealingCards(true);
        // RoleDealAnimation calls setDealingCards(false) itself once its
        // spin → land → flip → hold sequence finishes — no fixed timer here.
      }
      if (cur === GamePhase.NIGHT) {
        setTransition('night');
      } else if (prev === GamePhase.NIGHT && (cur === GamePhase.DAY_REVEAL || cur === GamePhase.DISCUSSION)) {
        setTransition('day');
      }
      prevPhaseRef.current = cur;
    }
  }, [roomState?.phase]);

  useEffect(() => {
    if (!transition) return;
    const t = setTimeout(() => setTransition(null), 3200);
    return () => clearTimeout(t);
  }, [transition]);

  useEffect(() => {
    if (!errorMessage) return;
    const timeout = setTimeout(() => dispatch({ type: 'ERROR', message: null }), 4000);
    return () => clearTimeout(timeout);
  }, [errorMessage, dispatch]);

  // BGM per phase.
  useEffect(() => {
    if (!roomState) return;
    if (gameOver) {
      audioManager.playBgm(gameOver.winningTeam === 'WEREWOLF' ? 'werewolvesWin' : 'villagersWin');
      return;
    }
    switch (roomState.phase) {
      case GamePhase.WAITING:
      case GamePhase.ROLE_ASSIGN:
        audioManager.playBgm('lobby');
        break;
      case GamePhase.NIGHT:
        audioManager.playBgm('night');
        break;
      case GamePhase.DAY_REVEAL:
        audioManager.playBgm('result');
        break;
      case GamePhase.DISCUSSION:
        audioManager.playBgm('day');
        break;
      case GamePhase.VOTING:
        audioManager.playBgm('voting');
        break;
      default:
        break;
    }
  }, [roomState?.phase, gameOver]);

  useEffect(() => () => audioManager.stopBgm(), []);

  // SFX: bell on new day reveal, wolf howl on entering night, error blip.
  useEffect(() => {
    if (roomState?.phase === GamePhase.NIGHT) audioManager.playSfx('wolfHowl');
  }, [roomState?.phase === GamePhase.NIGHT]);

  useEffect(() => {
    if (lastDayReveal && lastDayReveal !== lastDayRevealRef.current) {
      audioManager.playSfx('bell');
      lastDayRevealRef.current = lastDayReveal;
    }
  }, [lastDayReveal]);

  useEffect(() => {
    if (errorMessage && errorMessage !== lastErrorRef.current) {
      audioManager.playSfx('error');
      lastErrorRef.current = errorMessage;
    }
  }, [errorMessage]);


  if (!roomState || !myPlayerId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-mist-400">
        Đang kết nối tới phòng {roomId}...
      </div>
    );
  }

  const isHost = roomState.hostPlayerId === myPlayerId;
  const teammateNicknames =
    myRoleInfo?.teammateIds?.map(
      (id) => roomState.players.find((p) => p.id === id)?.nickname ?? '?',
    ) ?? [];
  const isNight = roomState.phase === GamePhase.NIGHT;
  const isDiscussion = roomState.phase === GamePhase.DISCUSSION;
  const isWaiting = roomState.phase === GamePhase.WAITING;
  const chatAvailable = isDiscussion || isWaiting;

  const phaseLabel: Record<string, string> = {
    [GamePhase.WAITING]: 'Phòng chờ',
    [GamePhase.ROLE_ASSIGN]: 'Chia bài',
    [GamePhase.NIGHT]: 'Ban đêm',
    [GamePhase.DAY_REVEAL]: 'Bình minh',
    [GamePhase.MAYOR_ELECTION]: 'Bầu Trưởng Làng',
    [GamePhase.DISCUSSION]: 'Thảo luận',
    [GamePhase.VOTING]: 'Bỏ phiếu',
    [GamePhase.GAME_OVER]: 'Kết thúc',
  };

  return (
    <div className={`rm-stage ${isNight ? 'is-night' : ''}`}>
      <div className="rm-bg-layer rm-bg-day" />
      <div className="rm-bg-layer rm-bg-night" />
      <div className="rm-scrim" />

      <div className="rm-hud">
        <div className="rm-hud-bar">
          <button type="button" className="rm-hud-icon" onClick={() => setShowSettings(true)} aria-label="Cài đặt">
            <img src="/ui/room/icon_settings.png" alt="" />
          </button>
          <div className="rm-hud-sep" />
          <span className="rm-hud-text">
            {phaseLabel[roomState.phase] ?? roomState.phase}
            {countdown !== null && ` · ${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`}
          </span>
          <div className="rm-hud-sep" />
          <button
            type="button"
            className="rm-hud-icon"
            onClick={() => setShowChat((v) => !v)}
            disabled={!chatAvailable}
            title={chatAvailable ? 'Trò chuyện' : 'Chỉ dùng được lúc chờ hoặc thảo luận'}
            aria-label="Trò chuyện"
          >
            <img src="/ui/room/icon_chat.png" alt="" />
          </button>
          <div className="rm-hud-sep" />
          <button
            type="button"
            className={`rm-hud-icon ${micEnabled ? 'is-active' : ''}`}
            onClick={() => setMicEnabled((v) => !v)}
            disabled={me ? !me.isAlive : false}
            title={me?.isAlive === false ? 'Bạn đã qua đời — không thể nói' : micEnabled ? 'Tắt micro' : 'Bật micro'}
            aria-label="Micro"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="18" x2="12" y2="22" />
              {!micEnabled && <line x1="3" y1="3" x2="21" y2="21" />}
            </svg>
          </button>
          <div className="rm-hud-sep" />
          <button type="button" className="rm-hud-icon" onClick={onOpenCardGallery} aria-label="Lá bài">
            <img src="/ui/lobby/list_button.png" alt="" />
          </button>
          <div className="rm-hud-sep" />
          <span className="rm-hud-text">Mã: {roomId}</span>
        </div>
      </div>

      <MoonPhaseIndicator
        phase={roomState.phase}
        playerCount={roomState.players.length}
        maxPlayers={roomState.config.maxPlayers}
      />

      {transition && (
        <div className={`rm-transition active ${transition}`}>
          <div className="rm-tr-dim" />
          <div className={`rm-tr-body ${transition === 'night' ? 'moon' : 'sun'}`} />
          <div className="rm-tr-text">
            <div className="rm-tr-title">{transition === 'night' ? '🌙 TRỜI ĐÃ TỐI' : '🌅 TRỜI ĐÃ SÁNG'}</div>
            <div className="rm-tr-subtitle">
              {transition === 'night' ? 'Mọi người hãy nhắm mắt. Ma Sói bắt đầu thức dậy.' : 'Hãy bắt đầu thảo luận để tìm ra Ma Sói.'}
            </div>
          </div>
        </div>
      )}

      {roomState.phase !== GamePhase.GAME_OVER && (
        <PlayerCircle
          players={roomState.players}
          myPlayerId={myPlayerId}
          speakingIds={speakingId ? new Set([...voiceChat.speakingPeerIds, speakingId]) : voiceChat.speakingPeerIds}
        />
      )}

      {showSettings && (
        <InRoomSettingsPanel
          players={roomState.players}
          myPlayerId={myPlayerId}
          onClose={() => setShowSettings(false)}
          onLeaveRoom={onLeaveRoom}
          onMasterVolumeChange={voiceChat.applyAllVolumes}
          onPlayerVolumeChange={voiceChat.applyVolume}
          onMicVolumeChange={voiceChat.applyMicGain}
        />
      )}

      <div className="rm-content space-y-5">
      {errorMessage && (
        <div className="rounded-lg border border-blood-500/50 bg-blood-500/10 px-4 py-2 text-sm text-blood-500">
          {errorMessage}
        </div>
      )}

      {voiceChat.micError && micEnabled && (
        <div className="rounded-lg border border-blood-500/50 bg-blood-500/10 px-4 py-2 text-sm text-blood-500">
          {voiceChat.micError}
        </div>
      )}

      {roomState.phase === GamePhase.WAITING && (
        <div className="mt-1 mb-2 flex justify-center">
          <p className="text-center text-sm font-medium text-parchment-100 bg-night-950/70 border border-moon-400/30 rounded-full px-5 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {isHost ? 'Nhấn "Bắt đầu ván đấu" khi mọi người đã sẵn sàng.' : 'Đang chờ chủ phòng bắt đầu...'}
          </p>
        </div>
      )}

      {roomState.phase === GamePhase.ROLE_ASSIGN && myRoleInfo && (
        dealingCards ? (
          <RoleDealAnimation role={myRoleInfo.role} onDone={() => setDealingCards(false)} />
        ) : (
          <RoleRevealModal roleInfo={myRoleInfo} teammateNicknames={teammateNicknames} />
        )
      )}

      {roomState.phase === GamePhase.NIGHT && (
        <div className="space-y-4">
          {nightPrompt ? (
            <NightActionPanel
              nightPrompt={nightPrompt}
              players={roomState.players}
              myPlayerId={myPlayerId}
            />
          ) : (
            <div className="rounded-xl border border-mist-600/40 bg-night-800 p-6 text-center text-mist-400">
              Màn đêm buông xuống... những người có khả năng đặc biệt đang hành động.
            </div>
          )}
        </div>
      )}

      {roomState.phase === GamePhase.DAY_REVEAL && lastDayReveal && (
        <DayRevealBanner reveal={lastDayReveal} players={roomState.players} />
      )}

      {roomState.phase === GamePhase.MAYOR_ELECTION && (
        <MayorElectionPanel state={roomState} myPlayerId={myPlayerId} voteTally={voteTally} />
      )}

      {roomState.phase === GamePhase.VOTING && (
        <VotingPanel state={roomState} myPlayerId={myPlayerId} voteTally={voteTally} maidPrompt={maidPrompt} />
      )}

      {chiefSuccessorPrompt && myPlayerId && (
        <ChiefSuccessorPrompt prompt={chiefSuccessorPrompt} players={roomState.players} />
      )}

      {mayorElected && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 rounded-full border border-amber-300/60 bg-night-950/90 px-5 py-2 text-sm font-semibold text-amber-300 shadow-lg animate-pulse">
          👑 {roomState.players.find((p) => p.id === mayorElected.playerId)?.nickname ?? 'Ai đó'} trở thành Trưởng Làng!
        </div>
      )}

      {roomState.phase === GamePhase.GAME_OVER && gameOver && (
        <GameOverScreen result={gameOver} onLeaveRoom={onLeaveRoom} />
      )}

      {hunterPrompt && <HunterShotPanel prompt={hunterPrompt} players={roomState.players} />}
      {thiefCards && <ThiefChoiceModal cards={thiefCards} />}
      {maidNightPrompt && <MaidNightChoiceModal prompt={maidNightPrompt} />}
      {showChat && chatAvailable && (
        <DiscussionChat messages={chatMessages} myPlayerId={myPlayerId} onClose={() => setShowChat(false)} />
      )}
      </div>
    </div>
  );
}
