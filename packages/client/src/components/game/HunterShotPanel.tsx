import { useState } from 'react';
import { ClientEvents, HunterPromptPayload, Player } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { Timer } from '../common/Timer';

interface HunterShotPanelProps {
  prompt: HunterPromptPayload;
  players: Player[];
}

export function HunterShotPanel({ prompt, players }: HunterShotPanelProps) {
  const [submitted, setSubmitted] = useState(false);
  const eligible = players.filter((p) => prompt.eligibleTargetIds.includes(p.id));

  function handleShoot(targetId: string) {
    if (submitted) return;
    socket.emit(ClientEvents.HUNTER_SHOOT, { targetId });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-blood-500/40 bg-night-800 p-6 text-center text-mist-400">
        Bạn đã bắn. Đang chờ kết quả...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/90 p-4">
      <div className="max-w-md w-full rounded-2xl border border-blood-500/50 bg-night-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-blood-500">Phát súng cuối cùng</h3>
          <Timer seconds={prompt.timeoutSeconds} />
        </div>
        <p className="text-sm text-parchment-100/90">
          Bạn là Thợ săn và vừa gục ngã. Hãy chọn một người để bắn hạ theo cùng.
        </p>
        <div className="flex flex-wrap gap-3">
          {eligible.map((p) => (
            <PlayerAvatar key={p.id} player={p} selectable onSelect={() => handleShoot(p.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
