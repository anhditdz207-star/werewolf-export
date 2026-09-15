import { useState } from 'react';
import { ChiefSuccessorPromptPayload, ClientEvents, Player } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { Timer } from '../common/Timer';

interface ChiefSuccessorPromptProps {
  prompt: ChiefSuccessorPromptPayload;
  players: Player[];
}

export function ChiefSuccessorPrompt({ prompt, players }: ChiefSuccessorPromptProps) {
  const [submitted, setSubmitted] = useState(false);
  const eligible = players.filter((p) => prompt.eligibleTargetIds.includes(p.id));

  function handleChoose(targetId: string) {
    if (submitted) return;
    socket.emit(ClientEvents.CHIEF_CHOOSE_SUCCESSOR, { targetId });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 p-4">
        <div className="rounded-xl border border-moon-400/40 bg-night-800 p-6 text-center text-mist-400">
          Đã chọn người kế nhiệm...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 p-4">
      <div className="max-w-md w-full rounded-2xl border border-moon-400/50 bg-night-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-moon-400">Chỉ định người kế nhiệm</h3>
          <Timer seconds={prompt.timeoutSeconds} />
        </div>
        <p className="text-sm text-parchment-100/90">
          Bạn là Trưởng Làng và vừa qua đời. Hãy chọn một người còn sống để trao lại chức danh.
          Nếu không chọn kịp, chức danh sẽ bị bỏ trống.
        </p>
        <div className="flex flex-wrap gap-3">
          {eligible.map((p) => (
            <PlayerAvatar key={p.id} player={p} selectable onSelect={() => handleChoose(p.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
