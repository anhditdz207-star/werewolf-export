import { GameOverPayload, ROLE_DEFINITIONS } from '@werewolf/shared';

interface GameOverScreenProps {
  result: GameOverPayload;
  onLeaveRoom: () => void;
}

export function GameOverScreen({ result, onLeaveRoom }: GameOverScreenProps) {
  const winnerLabel =
    result.winningTeam === 'WEREWOLF' ? 'Phe Ma Sói chiến thắng!' : 'Phe Dân làng chiến thắng!';
  const winnerColor = result.winningTeam === 'WEREWOLF' ? 'text-blood-500' : 'text-moon-400';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/80 backdrop-blur-sm p-4 overflow-y-auto">
    <div className="rounded-xl border border-mist-600/40 bg-night-800 p-6 space-y-5 text-center max-w-lg w-full my-auto">
      <h2 className={`font-display text-4xl ${winnerColor}`}>{winnerLabel}</h2>

      <div className="flex flex-wrap justify-center gap-3">
        {result.allPlayers.map((p) => (
          <div
            key={p.id}
            className="flex flex-col items-center gap-1 rounded-lg border border-mist-600/40 px-3 py-2 w-24"
          >
            <span className="text-sm font-medium truncate w-full">{p.nickname}</span>
            <span className="text-xs text-moon-400">
              {p.role ? ROLE_DEFINITIONS[p.role].displayNameVi : ''}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onLeaveRoom}
        className="rounded-lg bg-moon-400 px-6 py-2.5 font-semibold text-night-950"
      >
        Về trang chủ
      </button>
    </div>
    </div>
  );
}
