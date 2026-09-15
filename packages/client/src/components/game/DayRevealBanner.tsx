import { DayRevealPayload, DeathCause, Player } from '@werewolf/shared';

interface DayRevealBannerProps {
  reveal: DayRevealPayload;
  players: Player[];
}

const CAUSE_LABEL: Record<DeathCause, string> = {
  [DeathCause.WEREWOLF]: 'bị Sói cắn',
  [DeathCause.WITCH_POISON]: 'bị đầu độc',
  [DeathCause.VOTED_OUT]: 'bị dân làng treo cổ',
  [DeathCause.LOVER_HEARTBREAK]: 'chết vì đau lòng khi người yêu qua đời',
  [DeathCause.HUNTER_SHOT]: 'bị Thợ săn bắn hạ',
  [DeathCause.WHITE_WOLF]: 'bị Sói Trắng sát hại',
  [DeathCause.RUSTY_KNIGHT_POISON]: 'trúng độc kiếm rỉ của Hiệp Sĩ',
};

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
                đã {CAUSE_LABEL[d.cause]}.
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
