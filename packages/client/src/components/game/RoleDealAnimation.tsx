import { useEffect, useRef, useState } from 'react';
import { RoleName } from '@werewolf/shared';
import { roleCardImageUrl } from '../../data/roleCardImage';
import { audioManager } from '../../lib/audio';
import './RoleDealAnimation.css';

interface RoleDealAnimationProps {
  role: RoleName;
  /** Called once the whole sequence (spin → land → flip → hold) has finished. */
  onDone: () => void;
}

const CARD_W = 108; // px — matches the card art's 2:3 aspect ratio via CSS.
const CARD_GAP = 14; // px
const PITCH = CARD_W + CARD_GAP;
// The winning slot sits early in the strip (a few padding cards before it,
// so it doesn't look like the reel stops right at the array's edge), with
// a long run of "spin" cards after it that get scrolled through first.
const WIN_INDEX = 4;
const TOTAL_ITEMS = 26;

const SPIN_MS = 4600;
const SETTLE_PAUSE_MS = 300;
const FLIP_MS = 700;
const HOLD_MS = 1300;

/**
 * Full-screen "case opening" style reveal: a long horizontal strip of
 * card backs slides left→right across the lobby background, decelerating
 * until the winning slot lands under the center pointer, then flips to
 * show the player's actual role card. Plays while the game transitions
 * out of the waiting room into the first night.
 */
export function RoleDealAnimation({ role, onDone }: RoleDealAnimationProps) {
  const [containerW, setContainerW] = useState(0);
  const [translateX, setTranslateX] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => setContainerW(viewportRef.current?.clientWidth ?? window.innerWidth);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!containerW) return;
    const centerFor = (index: number) => containerW / 2 - CARD_W / 2 - index * PITCH;
    // Start positioned as if we'd already scrolled to the far end of the
    // strip, then animate back to the winning index — see module doc for
    // why this direction reads as "left to right" on screen.
    setTranslateX(centerFor(TOTAL_ITEMS - 1));
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinning(true);
        setTranslateX(centerFor(WIN_INDEX));
        audioManager.playSfx('roleRevealSpin');
        audioManager.vibrate(20);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [containerW]);

  useEffect(() => {
    if (!spinning) return;
    const flipTimer = setTimeout(() => {
      setFlipped(true);
      audioManager.playSfx('success');
      audioManager.vibrate([15, 40, 15]);
    }, SPIN_MS + SETTLE_PAUSE_MS);
    const doneTimer = setTimeout(onDone, SPIN_MS + SETTLE_PAUSE_MS + FLIP_MS + HOLD_MS);
    return () => {
      clearTimeout(flipTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  const items = Array.from({ length: TOTAL_ITEMS }, (_, i) => i);

  return (
    <div className="rda-overlay">
      <div className="rda-bg" />
      <div className="rda-scrim" />
      <p className="rda-caption">{flipped ? 'Vai trò của bạn đã lộ diện' : 'Đang rút thẻ...'}</p>

      <div className="rda-pointer rda-pointer-top" />
      <div ref={viewportRef} className="rda-viewport">
        <div
          className="rda-track"
          style={{
            transform: translateX !== null ? `translateX(${translateX}px)` : undefined,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.09, 0.8, 0.14, 1)` : 'none',
            visibility: translateX === null ? 'hidden' : 'visible',
          }}
        >
          {items.map((i) => {
            const isWinner = i === WIN_INDEX;
            return (
              <div key={i} className="rda-card" style={{ width: CARD_W, marginRight: CARD_GAP }}>
                <div className={`rda-card-inner ${isWinner && flipped ? 'is-flipped' : ''}`}>
                  <img className="rda-card-face rda-card-back" src="/cards/full/back.jpg" alt="" />
                  {isWinner && (
                    <img
                      className="rda-card-face rda-card-front"
                      src={roleCardImageUrl(role, 'full')}
                      alt=""
                    />
                  )}
                </div>
                {isWinner && flipped && <div className="rda-glow" />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rda-pointer rda-pointer-bottom" />
    </div>
  );
}
