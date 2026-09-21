import { useEffect, useRef, useState } from 'react';
import { NightActionConfirmedPayload, Player } from '@werewolf/shared';
import { RoleActionEffect, RoleActionKind } from './RoleActionEffect';
import { SUBPHASE_EFFECT_KIND } from './subPhaseEffectKind';

interface SpectatorNightEffectProps {
  nightActionConfirmed: NightActionConfirmedPayload | null;
  players: Player[];
}

/**
 * Lets a DEAD player watch the same night-action effects the acting
 * players see — "ghosts see everything" (see StateSanitizer for the
 * matching role-visibility rule). Only mounted for dead viewers (see
 * RoomPage), and only reacts to NIGHT_ACTION_CONFIRMED, which the server
 * already restricts to teammates + dead players — never a living
 * non-teammate. Reuses RoleActionEffect as-is; no separate spectator
 * animation system needed.
 */
export function SpectatorNightEffect({ nightActionConfirmed, players }: SpectatorNightEffectProps) {
  const [effect, setEffect] = useState<{ kind: RoleActionKind; targetIds: string[] } | null>(null);
  const lastSeenRef = useRef<NightActionConfirmedPayload | null>(null);

  useEffect(() => {
    if (!nightActionConfirmed || nightActionConfirmed === lastSeenRef.current) return;
    lastSeenRef.current = nightActionConfirmed;
    const kind = SUBPHASE_EFFECT_KIND[nightActionConfirmed.subPhase];
    if (kind && nightActionConfirmed.targetIds.length > 0) {
      setEffect({ kind, targetIds: nightActionConfirmed.targetIds });
    }
  }, [nightActionConfirmed]);

  if (!effect) return null;

  const targets = effect.targetIds.map((id) => {
    const p = players.find((pl) => pl.id === id);
    return { nickname: p?.nickname ?? 'Người chơi', avatarUrl: p?.avatarUrl };
  });

  return <RoleActionEffect kind={effect.kind} targets={targets} onDone={() => setEffect(null)} />;
}
