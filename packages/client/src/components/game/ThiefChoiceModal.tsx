import { useState } from 'react';
import { ClientEvents, ROLE_DEFINITIONS, ThiefCardsPayload } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';

interface ThiefChoiceModalProps {
  cards: ThiefCardsPayload;
}

export function ThiefChoiceModal({ cards }: ThiefChoiceModalProps) {
  const [submitted, setSubmitted] = useState(false);

  function choose(chosenRole: (typeof cards.options)[number] | null) {
    if (submitted) return;
    socket.emit(ClientEvents.THIEF_CHOOSE, { chosenRole });
    audioManager.playSfx('click');
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 backdrop-blur-sm p-4">
        <div className="max-w-sm w-full rounded-2xl border border-moon-400/40 bg-night-800 p-6 text-center space-y-2">
          <p className="text-moon-400 font-display text-xl">Đã chọn</p>
          <p className="text-sm text-mist-400">Đang chờ đêm đầu tiên bắt đầu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 backdrop-blur-sm p-4">
      <div className="max-w-md w-full rounded-2xl border border-moon-400/40 bg-night-800 p-6 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-mist-400">Tên Trộm</p>
        <h2 className="text-2xl font-display font-semibold text-moon-400">Hai lá bài dư</h2>
        <p className="text-sm text-parchment-100/90 leading-relaxed">
          Chọn một trong hai vai trò dưới đây để đổi lấy vai Tên Trộm của bạn, hoặc giữ nguyên.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {cards.options.map((role) => {
            const def = ROLE_DEFINITIONS[role];
            return (
              <button
                key={role}
                type="button"
                onClick={() => choose(role)}
                className="rounded-xl border border-mist-600/40 bg-night-700 p-4 space-y-1 hover:border-moon-400 transition-colors"
              >
                <p className="font-display text-lg text-moon-400">{def.displayNameVi}</p>
                <p className="text-xs text-mist-400 leading-snug">{def.descriptionVi}</p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => choose(null)}
          className="w-full rounded-lg border border-mist-600 py-2 text-parchment-100"
        >
          Giữ nguyên vai Tên Trộm
        </button>
      </div>
    </div>
  );
}
