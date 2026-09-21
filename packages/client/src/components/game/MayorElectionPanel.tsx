import { useState } from 'react';
import { ClientEvents, GameState } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';
import { PlayerAvatar } from '../common/PlayerAvatar';

interface MayorElectionPanelProps {
  state: GameState;
  myPlayerId: string;
  voteTally: Record<string, number>;
}

/** Public day-1 election for Trưởng Làng (Village Chief) — a title, not a
 * hidden role card. One vote per living player, simple majority. */
export function MayorElectionPanel({ state, myPlayerId, voteTally }: MayorElectionPanelProps) {
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const me = state.players.find((p) => p.id === myPlayerId);
  const candidates = state.players.filter((p) => p.isAlive);

  if (!me?.isAlive) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/70 backdrop-blur-sm p-4">
        <div className="rounded-xl border border-mist-600/40 bg-night-800 p-5 text-center text-mist-400 max-w-sm w-full">
          Bạn đã qua đời — chỉ có thể theo dõi cuộc bầu chọn.
        </div>
      </div>
    );
  }

  function handleVote(targetId: string) {
    socket.emit(ClientEvents.MAYOR_VOTE_CAST, { targetId });
    audioManager.playSfx('click');
    setVotedFor(targetId);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="rounded-xl border border-moon-400/50 bg-night-800 p-4 space-y-4 max-w-lg w-full my-auto">
        <div>
          <h3 className="font-display text-xl text-moon-400">Bầu Trưởng Làng</h3>
          <p className="text-sm text-parchment-100/80 mt-1">
            Cả làng cùng bầu chọn một Trưởng Làng. Người này có 2 lá phiếu trong các lần bỏ phiếu
            treo cổ sau này, và có quyền chỉ định người kế nhiệm nếu qua đời.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {candidates.map((p) => (
            <PlayerAvatar
              key={p.id}
              player={p}
              selectable
              selected={votedFor === p.id}
              voteCount={voteTally[p.id]}
              onSelect={() => handleVote(p.id)}
            />
          ))}
        </div>
        {votedFor && (
          <p className="text-sm text-moon-400">Bạn đã bầu. Có thể đổi ý cho đến hết giờ.</p>
        )}
      </div>
    </div>
  );
}
