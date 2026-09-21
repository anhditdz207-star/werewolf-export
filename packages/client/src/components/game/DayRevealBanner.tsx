import { DayRevealPayload, Player } from '@werewolf/shared';

interface DayRevealBannerProps {
  reveal: DayRevealPayload;
  players: Player[];
}

export function DayRevealBanner({ reveal, players }: DayRevealBannerProps) {
  return (
    <div className="rounded-xl border border-blood-500/40 bg-night-800 p-5 space-y-3">
      <h3 className="font-display text-2xl text-parchment-100">
        Bình minh ngày {reveal.dayCount}
      </h3>
      {reveal.deaths.length === 0 ? (
        <p className="text-mist-400">Đêm qua yên bình, không ai thiệt mạng.</p>
      ) : (
        <ul className="space-y-1">
          {reveal.deaths.map((d) => {
            const player = players.find((p) => p.id === d.playerId);
            return (
              <li key={d.playerId} className="text-parchment-100">
                <span className="font-semibold text-blood-500">
                  {player?.nickname ?? 'Người chơi'}
                </span>{' '}
                đã không qua khỏi đêm qua.
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
