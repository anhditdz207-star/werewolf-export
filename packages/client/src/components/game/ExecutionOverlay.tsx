import { useEffect, useState } from 'react';
import { PlayerHeadPortrait } from './PlayerHeadPortrait';
import { audioManager } from '../../lib/audio';
import './ExecutionOverlay.css';

interface ExecutionOverlayProps {
  nickname: string;
  avatarUrl?: string | null;
  onDone: () => void;
}

type Stage = 'in' | 'figure' | 'name' | 'pause' | 'rope' | 'hang' | 'swing' | 'result' | 'out';

const STAGE_TIMELINE: Array<[Stage, number]> = [
  ['in', 0],
  ['figure', 450],
  ['name', 950],
  ['pause', 1250],
  ['rope', 1850],
  ['hang', 2450],
  ['swing', 2850],
  ['result', 3050],
  ['out', 4450],
];
const TOTAL_MS = 4850;

/**
 * Full-screen cinematic shown once a day-vote execution resolves: a
 * stick-man wearing the victim's own avatar as its head, hanged from a
 * simple gallows, then settling on the result before handing back to
 * the normal game screen. Pure CSS/SVG, mirrors NightKillOverlay's
 * structure and timing conventions.
 */
export function ExecutionOverlay({ nickname, avatarUrl, onDone }: ExecutionOverlayProps) {
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
    if (stage === 'hang') {
      audioManager.playSfx('drumHit');
      audioManager.vibrate([20, 30, 60]);
    }
  }, [stage]);

  const initial = nickname.trim().charAt(0).toUpperCase() || '?';
  const stageIndex = STAGE_TIMELINE.findIndex(([s]) => s === stage);
  const atLeast = (s: Stage) => stageIndex >= STAGE_TIMELINE.findIndex(([x]) => x === s);

  return (
    <div
      className={[
        'ex-overlay',
        atLeast('in') ? 'ex-visible' : '',
        stage === 'out' ? 'ex-fading' : '',
        stage === 'hang' ? 'ex-snap' : '',
      ].join(' ')}
    >
      <div className="ex-vignette" />
      <div className="ex-fog" />

      <div className={`ex-figure-wrap ${atLeast('figure') ? 'ex-figure-in' : ''}`}>
        <svg viewBox="0 0 220 320" className="ex-svg">
          {/* Gallows — static */}
          <g stroke="#c9a869" strokeWidth="7" strokeLinecap="round" fill="none">
            <line x1="185" y1="300" x2="185" y2="26" />
            <line x1="185" y1="26" x2="86" y2="26" />
            <line x1="150" y1="300" x2="185" y2="300" />
            <line x1="185" y1="300" x2="220" y2="300" />
            <line x1="138" y1="58" x2="185" y2="26" />
          </g>

          {/* Rope + figure swing together around the beam attachment point. */}
          <g className={`ex-pendulum ${atLeast('swing') ? 'ex-swinging' : ''}`}>
            <g className={`ex-rope-wrap ${atLeast('rope') ? 'ex-rope-extend' : ''}`}>
              <line x1="86" y1="26" x2="86" y2="94" stroke="#b98d4d" strokeWidth="4" />
            </g>

            <g className={`ex-body ${atLeast('hang') ? 'ex-hanged' : ''}`}>
              <line x1="86" y1="122" x2="86" y2="200" stroke="#e9dcc0" strokeWidth="6" strokeLinecap="round" />
              <g className="ex-arm-l">
                <line x1="86" y1="132" x2="52" y2="172" stroke="#e9dcc0" strokeWidth="6" strokeLinecap="round" />
              </g>
              <g className="ex-arm-r">
                <line x1="86" y1="132" x2="120" y2="172" stroke="#e9dcc0" strokeWidth="6" strokeLinecap="round" />
              </g>
              <g className="ex-leg-l">
                <line x1="86" y1="200" x2="62" y2="278" stroke="#e9dcc0" strokeWidth="6" strokeLinecap="round" />
              </g>
              <g className="ex-leg-r">
                <line x1="86" y1="200" x2="110" y2="278" stroke="#e9dcc0" strokeWidth="6" strokeLinecap="round" />
              </g>
              <PlayerHeadPortrait avatarUrl={avatarUrl} initial={initial} cx={86} cy={104} r={38} />
            </g>
          </g>
        </svg>
      </div>

      <div className={`ex-name ${atLeast('name') ? 'ex-name-in' : ''}`}>{nickname}</div>

      <div className={`ex-result ${atLeast('result') ? 'ex-result-in' : ''}`}>
        đã bị dân làng treo cổ
      </div>
    </div>
  );
}
