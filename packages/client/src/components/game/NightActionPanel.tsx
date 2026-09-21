import { useEffect, useRef, useState } from 'react';
import {
  ClientEvents,
  NightActionConfirmedPayload,
  NightPromptPayload,
  NightSubPhase,
  Player,
} from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { Timer } from '../common/Timer';
import { useGameState } from '../../store/GameContext';
import { RoleActionEffect, RoleActionKind } from './effects/RoleActionEffect';
import { SUBPHASE_EFFECT_KIND } from './effects/subPhaseEffectKind';

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

// Sub-phases that get a private "confirmation" visual effect after the
// player submits — see components/game/effects/RoleActionEffect. Only
// the roles with a genuinely clear, lightweight effect are included;
// the rest (Seer, Fox, Cult Leader, Wild Child, ...) just submit plainly.
// Sub-phases that get a private "confirmation" visual effect after the
// player submits — see components/game/effects/subPhaseEffectKind. Only
// the roles with a genuinely clear, lightweight effect are included.
const ACTION_EFFECT_KIND = SUBPHASE_EFFECT_KIND;

export function NightActionPanel({ nightPrompt, players, myPlayerId }: NightActionPanelProps) {
  const { foxResult, littleGirlResult, allyRevealed, nightActionConfirmed } = useGameState();
  const [submitted, setSubmitted] = useState(false);
  const [cupidFirstPick, setCupidFirstPick] = useState<string | null>(null);
  const [flutistPicks, setFlutistPicks] = useState<string[]>([]);
  const [actionEffect, setActionEffect] = useState<{ kind: RoleActionKind; targetIds: string[] } | null>(null);
  const me = players.find((p) => p.id === myPlayerId);
  const eligible = players.filter((p) => nightPrompt.eligibleTargetIds.includes(p.id));
  const subPhase = nightPrompt.subPhase;

  // A single NightActionPanel instance can stay mounted across more than
  // one sub-phase in the same night (e.g. a werewolf who is also prompted
  // again for WEREWOLF_BONUS) since it's never unmounted in between — so
  // per-sub-phase UI state must reset whenever a genuinely new prompt
  // arrives. Doing it here (during render, not in an effect) avoids a
  // one-frame flash of the previous sub-phase's "submitted" screen.
  const lastSubPhaseRef = useRef(subPhase);
  if (lastSubPhaseRef.current !== subPhase) {
    lastSubPhaseRef.current = subPhase;
    if (submitted) setSubmitted(false);
    if (actionEffect) setActionEffect(null);
    if (cupidFirstPick) setCupidFirstPick(null);
    if (flutistPicks.length) setFlutistPicks([]);
  }

  // If a teammate (in practice only relevant for the werewolf pack, since
  // every other role is a party of one) locks in the pack's decision
  // before I click anything myself, show the same confirmation effect I
  // would have seen had I submitted it — purely visual, no action of my
  // own is sent.
  const lastConfirmedRef = useRef<NightActionConfirmedPayload | null>(null);
  useEffect(() => {
    if (
      nightActionConfirmed &&
      nightActionConfirmed !== lastConfirmedRef.current &&
      nightActionConfirmed.subPhase === subPhase &&
      !submitted
    ) {
      lastConfirmedRef.current = nightActionConfirmed;
      setSubmitted(true);
      const kind = ACTION_EFFECT_KIND[subPhase];
      if (kind && nightActionConfirmed.targetIds.length > 0) {
        setActionEffect({ kind, targetIds: nightActionConfirmed.targetIds });
      }
    }
  }, [nightActionConfirmed, subPhase, submitted]);

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
    const kind = ACTION_EFFECT_KIND[subPhase];
    if (kind) setActionEffect({ kind, targetIds: [targetId] });
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
    setActionEffect({ kind: 'cupid', targetIds: [cupidFirstPick, targetId] });
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
    setActionEffect({ kind: 'witch-poison', targetIds: [targetId] });
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
    setActionEffect({ kind: 'flutist', targetIds: flutistPicks });
  }

  const allyBanner = allyRevealed && (
    <p className="text-sm text-moon-400">
      Đồng đội của bạn: {allyRevealed.allyIds.map((id) => players.find((p) => p.id === id)?.nickname ?? '?').join(', ')}
    </p>
  );

  if (actionEffect) {
    const targets = actionEffect.targetIds.map((id) => {
      const p = players.find((pl) => pl.id === id);
      return { nickname: p?.nickname ?? 'Người chơi', avatarUrl: p?.avatarUrl };
    });
    return (
      <RoleActionEffect
        kind={actionEffect.kind}
        targets={targets}
        onDone={() => setActionEffect(null)}
      />
    );
  }

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
