import { NightActionConfirmedPayload, Player } from '@werewolf/shared';
import { SUBPHASE_EFFECT_KIND } from './subPhaseEffectKind';
import { RoleActionKind } from './RoleActionEffect';

interface NightActionLogViewProps {
  entries: NightActionConfirmedPayload[];
  players: Player[];
}

// Third-person, spectator-facing phrasing — distinct from RoleActionEffect's
// first-person RESULT_TEXT (which is written for the acting player).
const LOG_LABEL: Record<RoleActionKind, string> = {
  werewolf: '🐺 Sói đã cắn',
  'white-wolf': '❄️ Sói Trắng đã tiêu diệt',
  'witch-poison': '🧪 Phù Thủy đã đầu độc',
  guard: '🛡️ Bảo Vệ đã bảo vệ',
  seer: '🔮 Tiên Tri đã soi',
  fox: '🔍 Cáo đã dò xét',
  'cult-leader': '🌀 Giáo Chủ đã chiêu mộ',
  'wild-child': '✨ Kẻ Hoang Dã đã chọn thần tượng',
  cupid: '💘 Cupid đã se duyên',
  flutist: '🎵 Người Thổi Sáo đã mê hoặc',
  hunter: '🎯 Thợ Săn đã bắn hạ',
};

/**
 * Static (non-animated) catch-up list of this night's confirmed actions,
 * for a dead player who missed some of the live RoleActionEffect
 * animations (e.g. reconnected mid-night — see ServerEvents.NIGHT_ACTION_LOG).
 * Reuses the same SUBPHASE_EFFECT_KIND mapping as the live effects so the
 * two can never disagree on which sub-phases are spectator-visible.
 */
export function NightActionLogView({ entries, players }: NightActionLogViewProps) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-mist-600/40 bg-night-800 p-4 space-y-2">
      <p className="text-xs uppercase tracking-widest text-mist-400">Bạn đang xem với tư cách khán giả</p>
      <ul className="space-y-1 text-sm text-parchment-100">
        {entries.map((entry, i) => {
          const kind = SUBPHASE_EFFECT_KIND[entry.subPhase];
          if (!kind) return null;
          const names = entry.targetIds
            .map((id) => players.find((p) => p.id === id)?.nickname ?? '?')
            .join(' & ');
          return (
            <li key={i}>
              {LOG_LABEL[kind]} <span className="font-semibold text-moon-400">{names}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
