import { useEffect, useState } from 'react';
import { PlayerHeadPortrait } from './PlayerHeadPortrait';
import { audioManager } from '../../lib/audio';
import './NightKillOverlay.css';

interface NightKillOverlayProps {
  nickname: string;
  avatarUrl?: string | null;
  onDone: () => void;
}

type Stage = 'in' | 'stone' | 'avatar' | 'name' | 'result' | 'out';

// Cumulative delay (ms) at which each stage kicks in.
const STAGE_TIMELINE: Array<[Stage, number]> = [
  ['in', 0],
  ['stone', 350],
  ['avatar', 900],
  ['name', 1250],
  ['result', 1550],
  ['out', 3500],
];
const TOTAL_MS = 3900;

/**
 * Morning death announcement: a simple tombstone/RIP marker with the
 * victim's own avatar set into it and their name below. Deliberately
 * calm/somber rather than violent — the werewolf's 3-claw slash effect
 * now plays privately during the werewolf's own kill action instead
 * (see effects/RoleActionEffect + effects/ClawSlash), so the morning
 * reveal itself no longer needs to dramatize HOW the player died (and
 * per game rules, the cause stays hidden from living players anyway).
 */
export function NightKillOverlay({ nickname, avatarUrl, onDone }: NightKillOverlayProps) {
  const [stage, setStage] = useState<Stage>('in');

  useEffect(() => {
    const timers = STAGE_TIMELINE.map(([s, delay]) => setTimeout(() => setStage(s), delay));
    const doneTimer = setTimeout(onDone, TOTAL_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage === 'stone') {
      audioManager.playSfx('bell');
    }
  }, [stage]);

  const initial = nickname.trim().charAt(0).toUpperCase() || '?';
  const stageIndex = STAGE_TIMELINE.findIndex(([s]) => s === stage);
  const atLeast = (s: Stage) => stageIndex >= STAGE_TIMELINE.findIndex(([x]) => x === s);

  return (
    <div className={`nk-overlay ${atLeast('in') ? 'nk-visible' : ''} ${stage === 'out' ? 'nk-fading' : ''}`}>
      <div className="nk-vignette" />
      <div className="nk-fog nk-fog-1" />
      <div className="nk-fog nk-fog-2" />

      <div className={`nk-figure ${atLeast('stone') ? 'nk-figure-in' : ''}`}>
        <svg viewBox="0 0 200 260" className="nk-svg">
          {/* Ground mound */}
          <ellipse cx="100" cy="238" rx="88" ry="10" fill="#0b0f1a" opacity="0.6" />
          {/* Tombstone */}
          <path
            d="M40 236 L40 112 A60 60 0 0 1 160 112 L160 236 Z"
            fill="#3a3c42"
            stroke="#c9cdd6"
            strokeWidth="4"
          />
          <text x="100" y="150" textAnchor="middle" fontSize="22" fontWeight="700" fill="#c9cdd6" letterSpacing="2">
            R.I.P
          </text>
          <g className={atLeast('avatar') ? 'nk-avatar-in' : 'nk-avatar-hidden'}>
            <PlayerHeadPortrait avatarUrl={avatarUrl} initial={initial} cx={100} cy={192} r={34} />
          </g>
        </svg>
      </div>

      <div className={`nk-name ${atLeast('name') ? 'nk-name-in' : ''}`}>{nickname}</div>

      <div className={`nk-result ${atLeast('result') ? 'nk-result-in' : ''}`}>
        đã không qua khỏi đêm qua
      </div>
    </div>
  );
}
