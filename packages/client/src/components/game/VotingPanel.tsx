import { useState } from 'react';
import { ClientEvents, GameState, MaidPromptPayload, RoleName, VotingSubPhase } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';
import { PlayerAvatar } from '../common/PlayerAvatar';

interface VotingPanelProps {
  state: GameState;
  myPlayerId: string;
  voteTally: Record<string, number>;
  maidPrompt?: MaidPromptPayload | null;
}

export function VotingPanel({ state, myPlayerId, voteTally, maidPrompt }: VotingPanelProps) {
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [judgeRevoteUsed, setJudgeRevoteUsed] = useState(false);
  const [maidDecided, setMaidDecided] = useState(false);
  const me = state.players.find((p) => p.id === myPlayerId);
  const candidates = state.players.filter((p) => p.isAlive);

  function handleMaidSwap(swap: boolean) {
    if (maidDecided) return;
    socket.emit(ClientEvents.MAID_SWAP, { swap });
    audioManager.playSfx('click');
    setMaidDecided(true);
  }

  // Maid's prompt takes over the panel — it appears right after a hanging
  // result, independent of the normal vote-casting UI below.
  if (maidPrompt && me?.role === RoleName.MAID) {
    const victim = state.players.find((p) => p.id === maidPrompt.victimId);
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/70 backdrop-blur-sm p-4">
      <div className="rounded-xl border border-moon-400/40 bg-night-800 p-5 text-center space-y-3 max-w-sm w-full">
        <h3 className="font-display text-xl text-moon-400">Quyết định của Hầu Gái</h3>
        {maidDecided ? (
          <p className="text-sm text-mist-400">Đã gửi lựa chọn...</p>
        ) : (
          <>
            <p className="text-sm text-parchment-100/90">
              {victim?.nickname ?? 'Người này'} vừa bị treo cổ. Bạn có muốn thế chỗ, trở thành vai trò của họ?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleMaidSwap(true)}
                className="flex-1 rounded-lg bg-moon-400 py-2 font-semibold text-night-950"
              >
                Thế chỗ
              </button>
              <button
                type="button"
                onClick={() => handleMaidSwap(false)}
                className="flex-1 rounded-lg border border-mist-600 py-2 text-parchment-100"
              >
                Không, giữ vai hiện tại
              </button>
            </div>
          </>
        )}
      </div>
      </div>
    );
  }

  if (!me?.isAlive) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/70 backdrop-blur-sm p-4">
      <div className="rounded-xl border border-mist-600/40 bg-night-800 p-5 text-center text-mist-400 max-w-sm w-full">
        Bạn đã qua đời — chỉ có thể theo dõi cuộc bỏ phiếu.
      </div>
      </div>
    );
  }

  function handleVote(targetId: string) {
    if (targetId === myPlayerId) return;
    socket.emit(ClientEvents.VOTE_CAST, { targetId });
    audioManager.playSfx('click');
    setVotedFor(targetId);
  }

  function handleJudgeForceRevote() {
    if (judgeRevoteUsed) return;
    socket.emit(ClientEvents.JUDGE_FORCE_REVOTE);
    audioManager.playSfx('click');
    setJudgeRevoteUsed(true);
  }

  const canForceRevote =
    me.role === RoleName.CORRUPT_JUDGE &&
    !!me.corruptJudgeState &&
    !me.corruptJudgeState.hasUsedRevote &&
    state.votingSubPhase !== VotingSubPhase.REVOTE &&
    !judgeRevoteUsed;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-night-950/70 backdrop-blur-sm p-4 overflow-y-auto">
    <div className="rounded-xl border border-blood-500/40 bg-night-800 p-4 space-y-4 max-w-lg w-full my-auto">
      <h3 className="font-display text-xl text-blood-500">
        {state.votingSubPhase === VotingSubPhase.REVOTE ? 'Bầu lại (hòa phiếu)' : 'Bỏ phiếu treo cổ'}
      </h3>
      <div className="flex flex-wrap gap-3">
        {candidates.map((p) => (
          <PlayerAvatar
            key={p.id}
            player={p}
            selectable={p.id !== myPlayerId}
            selected={votedFor === p.id}
            voteCount={voteTally[p.id]}
            onSelect={() => handleVote(p.id)}
          />
        ))}
      </div>
      {votedFor && (
        <p className="text-sm text-moon-400">Bạn đã bỏ phiếu. Có thể đổi ý cho đến hết giờ.</p>
      )}
      {canForceRevote && (
        <button
          type="button"
          onClick={handleJudgeForceRevote}
          className="w-full rounded-lg border border-moon-400 py-2 text-moon-400 text-sm"
        >
          Thẩm Phán Tha Hóa: Yêu cầu bầu lại (dùng một lần)
        </button>
      )}
      {judgeRevoteUsed && (
        <p className="text-sm text-mist-400">Đã yêu cầu bầu lại.</p>
      )}
    </div>
    </div>
  );
}
