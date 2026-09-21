import { Player, ROLE_DEFINITIONS } from '@werewolf/shared';

interface PlayerAvatarProps {
  player: Player;
  isSelf?: boolean;
  selectable?: boolean;
  selected?: boolean;
  voteCount?: number;
  onSelect?: (playerId: string) => void;
}

export function PlayerAvatar({
  player,
  isSelf,
  selectable,
  selected,
  voteCount,
  onSelect,
}: PlayerAvatarProps) {
  const initial = player.nickname.trim().charAt(0).toUpperCase() || '?';
  const roleLabel = player.role ? ROLE_DEFINITIONS[player.role].displayNameVi : null;

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={() => onSelect?.(player.id)}
      className={[
        'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 transition-colors w-24 text-center',
        !player.isAlive ? 'opacity-40 grayscale' : '',
        selected ? 'border-moon-400 bg-night-700' : 'border-mist-600/40 bg-night-800',
        selectable ? 'cursor-pointer hover:border-moon-400' : 'cursor-default',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-11 w-11 items-center justify-center rounded-full text-lg font-display font-semibold overflow-hidden',
          isSelf ? 'bg-moon-400 text-night-950' : 'bg-night-700 text-parchment-100',
        ].join(' ')}
      >
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          initial
        )}
      </div>
      <span className="text-sm font-medium leading-tight truncate w-full">{player.nickname}</span>
      {player.isVillageChief && (
        <span className="text-[10px] font-semibold text-amber-300" title="Trưởng Làng — phiếu x2">
          👑 Trưởng Làng · x2
        </span>
      )}
      {player.isHost && <span className="text-[10px] text-moon-400">Chủ phòng</span>}
      {roleLabel && <span className="text-[10px] text-mist-400">{roleLabel}</span>}
      {!player.isAlive && <span className="text-[10px] text-blood-500">Đã chết</span>}
      {typeof voteCount === 'number' && voteCount > 0 && (
        <span className="text-[10px] font-mono text-blood-500">{voteCount} phiếu</span>
      )}
    </button>
  );
}
