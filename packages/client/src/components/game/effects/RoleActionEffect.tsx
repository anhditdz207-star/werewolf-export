import { useEffect, useState } from 'react';
import { PlayerHeadPortrait } from '../PlayerHeadPortrait';
import { ClawSlash } from './ClawSlash';
import { audioManager } from '../../../lib/audio';
import './RoleActionEffect.css';

export type RoleActionKind =
  | 'werewolf'
  | 'white-wolf'
  | 'witch-poison'
  | 'guard'
  | 'seer'
  | 'fox'
  | 'cult-leader'
  | 'wild-child'
  | 'cupid'
  | 'flutist'
  | 'hunter';

export interface RoleActionEffectTarget {
  nickname: string;
  avatarUrl?: string | null;
}

interface RoleActionEffectProps {
  kind: RoleActionKind;
  /** 1 target for most kinds; Cupid and Flutist use 2. */
  targets: RoleActionEffectTarget[];
  onDone: () => void;
}

const RESULT_TEXT: Record<RoleActionKind, string> = {
  werewolf: 'Đã chọn cắn người này đêm nay',
  'white-wolf': 'Đã chọn tiêu diệt người này',
  'witch-poison': 'Đã đầu độc người này',
  guard: 'Đang bảo vệ người này đêm nay',
  seer: 'Đã soi được thân phận người này',
  fox: 'Đã dò được khu vực này',
  'cult-leader': 'Đã chiêu mộ người này vào giáo phái',
  'wild-child': 'Đã chọn người này làm thần tượng',
  cupid: 'Đã se duyên hai người này',
  flutist: 'Đã mê hoặc hai người này',
  hunter: 'Đã bắn hạ người này',
};

type Stage = 'in' | 'figure' | 'act' | 'result' | 'out';
const TIMELINE: Array<[Stage, number]> = [
  ['in', 0],
  ['figure', 250],
  ['act', 750],
  ['result', 1500],
  ['out', 2200],
];
const TOTAL_MS = 2550;

/**
 * Small private confirmation effect for a night action, shown to:
 *  - the player who performed it, right after submitting;
 *  - any teammate who shared that sub-phase but didn't submit (in
 *    practice only the rest of the werewolf pack);
 *  - every dead player, watching as a spectator.
 * Never shown to a living non-teammate — see GameSession.onNightActionSubmitted.
 *
 * One component + one CSS file covers every role that got an effect
 * (rather than a separate animation system per role) — the `kind` prop
 * just switches which small visual plays over the shared stick-man(s).
 */
export function RoleActionEffect({ kind, targets, onDone }: RoleActionEffectProps) {
  const [stage, setStage] = useState<Stage>('in');

  useEffect(() => {
    const timers = TIMELINE.map(([s, delay]) => setTimeout(() => setStage(s), delay));
    const doneTimer = setTimeout(onDone, TOTAL_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage !== 'act') return;
    if (kind === 'werewolf' || kind === 'white-wolf' || kind === 'hunter') audioManager.vibrate([20, 40, 20, 40, 30]);
    if (kind === 'witch-poison' || kind === 'cult-leader') audioManager.playSfx('magicSpell');
    if (kind === 'guard' || kind === 'seer' || kind === 'fox') audioManager.playSfx('success');
    if (kind === 'cupid' || kind === 'wild-child' || kind === 'flutist') audioManager.playSfx('notification');
  }, [stage, kind]);

  const stageIndex = TIMELINE.findIndex(([s]) => s === stage);
  const atLeast = (s: Stage) => stageIndex >= TIMELINE.findIndex(([x]) => x === s);
  const isPaired = kind === 'cupid' || kind === 'flutist';
  const shown = isPaired ? targets.slice(0, 2) : targets.slice(0, 1);

  return (
    <div
      className={[
        'rae-overlay',
        atLeast('in') ? 'rae-visible' : '',
        stage === 'out' ? 'rae-fading' : '',
        kind === 'werewolf' && stage === 'act' ? 'rae-shaking' : '',
      ].join(' ')}
    >
      <div className={`rae-stage ${isPaired ? 'rae-stage-pair' : ''}`}>
        {shown.map((target, i) => (
          <div key={i} className={`rae-figure ${atLeast('figure') ? 'rae-figure-in' : ''}`}>
            <svg viewBox="0 0 200 300" className="rae-svg">
              <g stroke="#e9dcc0" strokeWidth="6" strokeLinecap="round" fill="none">
                <line x1="100" y1="97" x2="100" y2="190" />
                <line x1="100" y1="130" x2="55" y2="172" />
                <line x1="100" y1="130" x2="145" y2="172" />
                <line x1="100" y1="190" x2="65" y2="272" />
                <line x1="100" y1="190" x2="135" y2="272" />
              </g>
              <PlayerHeadPortrait
                avatarUrl={target.avatarUrl}
                initial={target.nickname.trim().charAt(0).toUpperCase() || '?'}
                cx={100}
                cy={55}
                r={44}
              />
            </svg>

            {(kind === 'werewolf' || kind === 'white-wolf') && (
              <ClawSlash active={stage === 'act' || stage === 'result' || stage === 'out'} />
            )}
            {kind === 'white-wolf' && <div className="rae-white-tint" data-active={stage === 'act'} />}

            {kind === 'witch-poison' && (
              <>
                <div className="rae-emoji rae-vial" data-active={stage === 'act'}>🧪</div>
                <div className="rae-poison-burst" data-active={stage === 'act' || stage === 'result'} />
              </>
            )}

            {kind === 'guard' && (
              <div className={`rae-badge ${atLeast('act') ? 'rae-badge-in' : ''}`}>
                <div className="rae-glow rae-glow-blue" />
                <span className="rae-emoji-static">🛡️</span>
              </div>
            )}

            {kind === 'seer' && (
              <div className={`rae-badge ${atLeast('act') ? 'rae-badge-in' : ''}`}>
                <div className="rae-glow rae-glow-purple" />
                <span className="rae-emoji-static">🔮</span>
              </div>
            )}

            {kind === 'fox' && (
              <div className={`rae-badge ${atLeast('act') ? 'rae-badge-in' : ''}`}>
                <div className="rae-glow rae-glow-orange" />
                <span className="rae-emoji-static">🔍</span>
              </div>
            )}

            {kind === 'cult-leader' && (
              <div className={`rae-hypno ${atLeast('act') ? 'rae-hypno-in' : ''}`}>🌀</div>
            )}

            {kind === 'wild-child' && (
              <div className={`rae-badge ${atLeast('act') ? 'rae-badge-in' : ''}`}>
                <div className="rae-glow rae-glow-gold" />
                <span className="rae-emoji-static">✨</span>
              </div>
            )}

            {kind === 'hunter' && (
              <div className={`rae-reticle ${atLeast('act') ? 'rae-reticle-in' : ''}`}>🎯</div>
            )}

            <div className={`rae-name ${atLeast('figure') ? 'rae-name-in' : ''}`}>{target.nickname}</div>
          </div>
        ))}

        {kind === 'cupid' && (
          <div className="rae-heart" data-active={atLeast('act')}>💘</div>
        )}
        {kind === 'flutist' && (
          <div className="rae-notes" data-active={atLeast('act')}>
            <span>🎵</span>
            <span>🎶</span>
          </div>
        )}
      </div>

      <div className={`rae-result ${atLeast('result') ? 'rae-result-in' : ''}`}>{RESULT_TEXT[kind]}</div>
    </div>
  );
}
