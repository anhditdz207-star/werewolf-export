import { useState } from 'react';
import { ClientEvents, NightPromptPayload, NightSubPhase, Player } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { Timer } from '../common/Timer';
import { useGameState } from '../../store/GameContext';

interface NightActionPanelProps {
  nightPrompt: NightPromptPayload;
  players: Player[];
  myPlayerId: string;
}

const SUBPHASE_TITLE: Record<string, string> = {
  [NightSubPhase.WEREWOLF]: 'Chọn nạn nhân đêm nay',
  [NightSubPhase.GUARD]: 'Chọn người để bảo vệ',
  [NightSubPhase.SEER]: 'Chọn người để soi',
  [NightSubPhase.WITCH]: 'Quyết định của Phù thủy',
  [NightSubPhase.CUPID]: 'Chọn hai người yêu nhau',
  [NightSubPhase.WEREWOLF_BONUS]: 'Chọn thêm nạn nhân thứ hai',
  [NightSubPhase.FATHER_WOLF_DECISION]: 'Biến nạn nhân thành Sói?',
  [NightSubPhase.WHITE_WOLF]: 'Chọn một Sói để tiêu diệt',
  [NightSubPhase.LITTLE_GIRL_PEEK]: 'Nhìn trộm cuộc họp của Sói?',
  [NightSubPhase.FOX]: 'Chọn tâm điểm để soi',
  [NightSubPhase.FLUTIST]: 'Chọn người để thôi miên',
  [NightSubPhase.CULT_LEADER]: 'Chọn người để chiêu mộ',
  [NightSubPhase.WILD_CHILD_IDOL]: 'Chọn thần tượng của bạn',
};

// Roles whose UI is just "pick exactly 1 eligible player, emit once".
const SIMPLE_SINGLE_TARGET_EVENTS: Partial<Record<string, string>> = {
  [NightSubPhase.WEREWOLF]: ClientEvents.NIGHT_ACTION_WEREWOLF,
  [NightSubPhase.GUARD]: ClientEvents.NIGHT_ACTION_GUARD,
  [NightSubPhase.SEER]: ClientEvents.NIGHT_ACTION_SEER,
  [NightSubPhase.WEREWOLF_BONUS]: ClientEvents.NIGHT_ACTION_WEREWOLF_BONUS,
  [NightSubPhase.WHITE_WOLF]: ClientEvents.NIGHT_ACTION_WHITE_WOLF,
  [NightSubPhase.FOX]: ClientEvents.NIGHT_ACTION_FOX,
  [NightSubPhase.CULT_LEADER]: ClientEvents.NIGHT_ACTION_CULT_LEADER,
  [NightSubPhase.WILD_CHILD_IDOL]: ClientEvents.NIGHT_ACTION_WILD_CHILD,
};

export function NightActionPanel({ nightPrompt, players, myPlayerId }: NightActionPanelProps) {
  const { foxResult, littleGirlResult, allyRevealed } = useGameState();
  const [submitted, setSubmitted] = useState(false);
  const [cupidFirstPick, setCupidFirstPick] = useState<string | null>(null);
  const [flutistPicks, setFlutistPicks] = useState<string[]>([]);
  const me = players.find((p) => p.id === myPlayerId);
  const eligible = players.filter((p) => nightPrompt.eligibleTargetIds.includes(p.id));
  const subPhase = nightPrompt.subPhase;

  function markSubmitted() {
    setSubmitted(true);
    audioManager.playSfx('click');
  }

  function pickSingleTarget(targetId: string) {
    if (submitted) return;
    const eventName = SIMPLE_SINGLE_TARGET_EVENTS[subPhase];
    if (!eventName) return;
    socket.emit(eventName, { targetId });
    markSubmitted();
  }

  function handleCupidPick(targetId: string) {
    if (submitted) return;
    if (!cupidFirstPick) {
      setCupidFirstPick(targetId);
      return;
    }
    if (targetId === cupidFirstPick) return;
    socket.emit(ClientEvents.NIGHT_ACTION_CUPID, {
      targetId1: cupidFirstPick,
      targetId2: targetId,
    });
    markSubmitted();
  }

  function handleWitchHeal() {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_WITCH, { action: 'heal' });
    markSubmitted();
  }

  function handleWitchPoison(targetId: string) {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_WITCH, { action: 'poison', targetId });
    markSubmitted();
  }

  function handleWitchSkip() {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_WITCH, { action: 'skip' });
    markSubmitted();
  }

  function handleFatherWolfDecision(convert: boolean) {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_FATHER_WOLF, { convert });
    markSubmitted();
  }

  function handleLittleGirlPeek(peek: boolean) {
    if (submitted) return;
    socket.emit(ClientEvents.NIGHT_ACTION_LITTLE_GIRL, { peek });
    markSubmitted();
  }

  function toggleFlutistPick(targetId: string) {
    if (submitted) return;
    setFlutistPicks((prev) => {
      if (prev.includes(targetId)) return prev.filter((id) => id !== targetId);
      if (prev.length >= 2) return prev;
      return [...prev, targetId];
    });
  }

  function submitFlutistPicks() {
    if (submitted || flutistPicks.length === 0) return;
    socket.emit(ClientEvents.NIGHT_ACTION_FLUTIST, { targetIds: flutistPicks });
    markSubmitted();
  }

  const allyBanner = allyRevealed && (
    <p className="text-sm text-moon-400">
      Đồng đội của bạn: {allyRevealed.allyIds.map((id) => players.find((p) => p.id === id)?.nickname ?? '?').join(', ')}
    </p>
  );

  if (submitted) {
    return (
      <div className="rounded-xl border border-mist-600/40 bg-night-800 p-6 text-center space-y-2">
        <p className="text-moon-400 font-display text-xl">Đã gửi lựa chọn</p>
        <p className="text-sm text-mist-400">Đang chờ những người khác...</p>
        {subPhase === NightSubPhase.FOX && foxResult && (
          <p className="text-sm text-parchment-100">
            Kết quả: {foxResult.hasWolf ? 'Có Sói trong khu vực này!' : 'Không phát hiện Sói nào.'}
          </p>
        )}
        {subPhase === NightSubPhase.LITTLE_GIRL_PEEK && littleGirlResult && (
          <p className="text-sm text-parchment-100">
            Sói là: {littleGirlResult.werewolfIds.map((id) => players.find((p) => p.id === id)?.nickname ?? '?').join(', ')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-moon-400/40 bg-night-800 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-moon-400">
          {SUBPHASE_TITLE[subPhase] ?? 'Hành động ban đêm'}
        </h3>
        <Timer seconds={nightPrompt.timeoutSeconds} />
      </div>

      {allyBanner}

      {subPhase === NightSubPhase.WITCH && me?.witchState ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!me.witchState.hasHealPotion}
              onClick={handleWitchHeal}
              className="flex-1 rounded-lg bg-moon-400 py-2 font-semibold text-night-950 disabled:opacity-30"
            >
              Cứu người bị cắn
            </button>
            <button
              type="button"
              onClick={handleWitchSkip}
              className="flex-1 rounded-lg border border-mist-600 py-2 text-parchment-100"
            >
              Bỏ qua
            </button>
          </div>
          {me.witchState.hasPoisonPotion && (
            <>
              <p className="text-sm text-mist-400">Hoặc chọn một người để đầu độc:</p>
              <div className="flex flex-wrap gap-3">
                {eligible.map((p) => (
                  <PlayerAvatar key={p.id} player={p} selectable onSelect={() => handleWitchPoison(p.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : subPhase === NightSubPhase.FATHER_WOLF_DECISION ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleFatherWolfDecision(true)}
            className="flex-1 rounded-lg bg-moon-400 py-2 font-semibold text-night-950"
          >
            Biến thành Sói
          </button>
          <button
            type="button"
            onClick={() => handleFatherWolfDecision(false)}
            className="flex-1 rounded-lg border border-mist-600 py-2 text-parchment-100"
          >
            Không, cứ để cắn chết
          </button>
        </div>
      ) : subPhase === NightSubPhase.LITTLE_GIRL_PEEK ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleLittleGirlPeek(true)}
            className="flex-1 rounded-lg bg-moon-400 py-2 font-semibold text-night-950"
          >
            Nhìn trộm (có rủi ro bị phát hiện)
          </button>
          <button
            type="button"
            onClick={() => handleLittleGirlPeek(false)}
            className="flex-1 rounded-lg border border-mist-600 py-2 text-parchment-100"
          >
            Không nhìn
          </button>
        </div>
      ) : subPhase === NightSubPhase.FLUTIST ? (
        <div className="space-y-3">
          <p className="text-sm text-mist-400">Chọn tối đa 2 người để thôi miên đêm nay.</p>
          <div className="flex flex-wrap gap-3">
            {eligible.map((p) => (
              <PlayerAvatar
                key={p.id}
                player={p}
                selectable
                selected={flutistPicks.includes(p.id)}
                onSelect={() => toggleFlutistPick(p.id)}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={flutistPicks.length === 0}
            onClick={submitFlutistPicks}
            className="w-full rounded-lg bg-moon-400 py-2 font-semibold text-night-950 disabled:opacity-30"
          >
            Xác nhận ({flutistPicks.length}/2)
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {eligible.map((p) => (
            <PlayerAvatar
              key={p.id}
              player={p}
              selectable
              selected={cupidFirstPick === p.id}
              onSelect={() =>
                subPhase === NightSubPhase.CUPID ? handleCupidPick(p.id) : pickSingleTarget(p.id)
              }
            />
          ))}
        </div>
      )}

      {subPhase === NightSubPhase.CUPID && cupidFirstPick && (
        <p className="text-sm text-moon-400">Đã chọn 1 người — chọn thêm 1 người nữa để ghép đôi.</p>
      )}
    </div>
  );
}
