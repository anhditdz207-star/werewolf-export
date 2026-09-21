import { useId } from 'react';

interface PlayerHeadPortraitProps {
  avatarUrl?: string | null;
  initial: string;
  cx: number;
  cy: number;
  r: number;
}

/**
 * Renders a circular player portrait (real avatar, or an initial-letter
 * fallback if none is set) as an SVG fragment — meant to be composed
 * inside a parent <svg> (e.g. as the head of a stick-man figure).
 * Shared by NightKillOverlay and ExecutionOverlay so the "avatar as head"
 * treatment stays visually identical between the two.
 */
export function PlayerHeadPortrait({ avatarUrl, initial, cx, cy, r }: PlayerHeadPortraitProps) {
  const clipId = useId();
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r + 3} fill="#0b0f1a" />
      {avatarUrl ? (
        <image
          href={avatarUrl}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <text
          x={cx}
          y={cy + r * 0.32}
          textAnchor="middle"
          fontSize={r * 0.95}
          fontWeight={700}
          fill="#e9dcc0"
        >
          {initial}
        </text>
      )}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e9dcc0" strokeWidth={3.5} />
    </>
  );
}
