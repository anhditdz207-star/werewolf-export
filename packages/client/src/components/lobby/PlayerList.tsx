import { Player } from '@werewolf/shared';
import { PlayerAvatar } from '../common/PlayerAvatar';

interface PlayerListProps {
  players: Player[];
  myPlayerId: string | null;
}

export function PlayerList({ players, myPlayerId }: PlayerListProps) {
  return (
    <div>
      <h3 className="text-sm text-mist-400 mb-2">Người chơi ({players.length})</h3>
      <div className="flex flex-wrap gap-3">
        {players.map((player) => (
          <PlayerAvatar key={player.id} player={player} isSelf={player.id === myPlayerId} />
        ))}
      </div>
    </div>
  );
}
