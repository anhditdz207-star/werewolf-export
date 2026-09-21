import { useEffect, useRef, useState } from 'react';
import { Player } from '@werewolf/shared';

interface PlayerCircleProps {
  players: Player[];
  myPlayerId: string | null;
  speakingIds?: Set<string>;
}

interface Point {
  x: number;
  y: number;
}

const TOP_SAFE_ZONE = 210; // keeps avatars clear of the fixed HUD bar + waiting-hint pill
const SIDE_PADDING = 24;
const BOTTOM_PADDING = 24;

/** Distributes N points evenly around the border of a safe-area rectangle. */
function computeBorderPositions(n: number, w: number, h: number): Point[] {
  if (n <= 0 || w <= 0 || h <= 0) return [];
  const rectW = Math.max(1, w - SIDE_PADDING * 2);
  const rectH = Math.max(1, h - TOP_SAFE_ZONE - BOTTOM_PADDING);
  const perim = 2 * (rectW + rectH);
  const start = rectW / 2;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (start + (perim * i) / n) % perim;
    let x: number;
    let y: number;
    if (t < rectW) {
      x = t;
      y = 0;
    } else if (t < rectW + rectH) {
      x = rectW;
      y = t - rectW;
    } else if (t < rectW * 2 + rectH) {
      x = rectW - (t - (rectW + rectH));
      y = rectH;
    } else {
      x = 0;
      y = rectH - (t - (rectW * 2 + rectH));
    }
    pts.push({ x: x + SIDE_PADDING, y: y + TOP_SAFE_ZONE });
  }
  return pts;
}

export function PlayerCircle({ players, myPlayerId, speakingIds }: PlayerCircleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const positions = computeBorderPositions(players.length, size.w, size.h);
  const avatarSize = players.length > 15 ? 44 : 64;

  return (
    <div ref={containerRef} className="rm-player-ring" aria-hidden={players.length === 0}>
      {players.map((player, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const isSelf = player.id === myPlayerId;
        const initial = player.nickname.trim().charAt(0).toUpperCase() || '?';
        return (
          <div
            key={player.id}
            className={`rm-player-slot ${!player.isAlive ? 'is-dead' : ''} ${isSelf ? 'is-self' : ''} ${speakingIds?.has(player.id) ? 'is-speaking' : ''}`}
            style={{ left: pos.x, top: pos.y, width: avatarSize, height: avatarSize + 20 }}
            title={player.nickname}
          >
            <div className="rm-player-avatar-wrap" style={{ width: avatarSize, height: avatarSize }}>
              {player.avatarUrl ? (
                <img src={player.avatarUrl} alt="" className="rm-player-avatar" draggable={false} />
              ) : (
                <div className="rm-player-avatar rm-player-avatar-fallback">{initial}</div>
              )}
              {!player.isAlive && <div className="rm-player-dead-mark">✕</div>}
              {player.isVillageChief && (
                <div className="rm-chief-badge" title="Trưởng Làng — được bầu chọn">
                  <span className="rm-chief-badge-title">Trưởng Làng</span>
                  <span className="rm-chief-badge-sub">Được bầu chọn</span>
                </div>
              )}
            </div>
            <span className="rm-player-name">{player.nickname}</span>
          </div>
        );
      })}
    </div>
  );
}
