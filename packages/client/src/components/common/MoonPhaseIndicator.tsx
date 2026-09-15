import { GamePhase } from '@werewolf/shared';

interface MoonPhaseIndicatorProps {
  phase: GamePhase | null;
  playerCount?: number;
  maxPlayers?: number;
}

/**
 * Compact top-left status badge: current phase label + a neon-gold
 * "joined/required" player counter. No circular art — just typography,
 * pinned to the corner so it never competes with the avatar ring or HUD.
 */
export function MoonPhaseIndicator({ phase, playerCount, maxPlayers }: MoonPhaseIndicatorProps) {
  const label = getPhaseLabel(phase);
  const showCount = typeof playerCount === 'number' && typeof maxPlayers === 'number' && maxPlayers > 0;

  return (
    <div className="rm-status-badge" role="status" aria-label={label}>
      <span className="rm-status-label">{label}</span>
      {showCount && (
        <span className="rm-status-count">
          {playerCount}<span className="rm-status-count-sep">/</span>{maxPlayers}
        </span>
      )}
    </div>
  );
}

function getPhaseLabel(phase: GamePhase | null): string {
  switch (phase) {
    case GamePhase.WAITING:
      return 'Chờ người chơi';
    case GamePhase.ROLE_ASSIGN:
      return 'Nhận vai trò';
    case GamePhase.NIGHT:
      return 'Ban đêm';
    case GamePhase.DAY_REVEAL:
      return 'Bình minh';
    case GamePhase.MAYOR_ELECTION:
      return 'Bầu Trưởng Làng';
    case GamePhase.DISCUSSION:
      return 'Thảo luận';
    case GamePhase.VOTING:
      return 'Bỏ phiếu';
    case GamePhase.GAME_OVER:
      return 'Kết thúc';
    default:
      return '';
  }
}
