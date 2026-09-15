import { useState } from 'react';
import { ClientEvents, MaidNightPromptPayload, ROLE_DEFINITIONS } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';
import { useGameState } from '../../store/GameContext';
import { roleCardImageUrl } from '../../data/roleCardImage';

interface MaidNightChoiceModalProps {
  prompt: MaidNightPromptPayload;
}

/**
 * Shown privately to a living Maid right after a night with 1+ deaths.
 * Unlike the day-vote Maid swap (which is blind — see MaidPrompt in
 * VotingPanel), here the roles are already known (dead players' roles
 * are public once revealed), so this shows the actual card art for each
 * candidate rather than plain text — closer to flipping through real
 * cards on the table.
 */
export function MaidNightChoiceModal({ prompt }: MaidNightChoiceModalProps) {
  const { roomState } = useGameState();
  const [submitted, setSubmitted] = useState(false);

  function nicknameOf(playerId: string): string {
    return roomState?.players.find((p) => p.id === playerId)?.nickname ?? 'Người chơi';
  }

  function choose(chosenVictimId: string | null) {
    if (submitted) return;
    socket.emit(ClientEvents.MAID_NIGHT_SWAP, { chosenVictimId });
    audioManager.playSfx('click');
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 backdrop-blur-sm p-4">
        <div className="max-w-sm w-full rounded-2xl border border-moon-400/40 bg-night-800 p-6 text-center space-y-2">
          <p className="text-moon-400 font-display text-xl">Đã chọn</p>
          <p className="text-sm text-mist-400">Đang chờ buổi sáng bắt đầu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 backdrop-blur-sm p-4">
      <div className="max-w-lg w-full rounded-2xl border border-moon-400/40 bg-night-800 p-6 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-mist-400">Hầu Gái</p>
        <h2 className="text-2xl font-display font-semibold text-moon-400">
          Đêm qua có {prompt.candidates.length} người ra đi
        </h2>
        <p className="text-sm text-parchment-100/90 leading-relaxed">
          Chọn một người để thế chỗ — bạn sẽ chết thay họ và lấy luôn vai trò của họ, còn họ sẽ sống
          lại và mang vai Hầu Gái của bạn.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {prompt.candidates.map(({ playerId, role }) => {
            const def = ROLE_DEFINITIONS[role];
            return (
              <button
                key={playerId}
                type="button"
                onClick={() => choose(playerId)}
                className="group rounded-xl border border-mist-600/40 bg-night-700 p-2 space-y-2 hover:border-moon-400 transition-colors"
              >
                <img
                  src={roleCardImageUrl(role, 'full')}
                  alt={def.displayNameVi}
                  className="w-full aspect-[3/4] rounded-lg object-cover border border-mist-600/30 group-hover:border-moon-400/60"
                />
                <p className="text-sm font-display text-moon-400 leading-tight">{def.displayNameVi}</p>
                <p className="text-xs text-mist-400 leading-tight truncate">{nicknameOf(playerId)}</p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => choose(null)}
          className="w-full rounded-lg border border-mist-600 py-2 text-parchment-100"
        >
          Không tráo đổi
        </button>
      </div>
    </div>
  );
}
