import type { CSSProperties } from 'react';

/**
 * Picture of a piece (ronda-3 §7, mockup .prod-ph): the photo of its technical sheet or, without one, a cube in the
 * color of its first filament (data color; var(--no-color) when it has none). The faces are shades of that color.
 * - photoUrl: the photo (wins over the cube). hexes: filament colors of the piece; only the first one is used.
 * - shape: 'square' (lists, 44 px by default) or 'wide' (product cards, 160 × 84).
 * - size: side in px of a square thumb.
 */
export function PieceThumb({ photoUrl, hexes, shape = 'square', size }: { photoUrl?: string | null | undefined; hexes: readonly string[]; shape?: 'square' | 'wide'; size?: number }) {
  const box = shape === 'square' ? { width: size ?? 44, height: size ?? 44 } : undefined;
  if (photoUrl) return <span className={`thumb ${shape} photo`} style={box}><img src={photoUrl} alt="" /></span>;
  const color = hexes[0] || 'var(--no-color)';
  const view = shape === 'wide' ? '0 0 160 84' : '-40 -40 80 80';
  const at = shape === 'wide' ? 'translate(80 42) scale(.82)' : 'scale(1.15)';
  return (
    <span className={`thumb ${shape} cube`} style={{ ...box, '--pc': color } as CSSProperties}>
      <svg viewBox={view} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        {shape === 'wide' ? <rect className="bg" width="160" height="84" /> : null}
        <g transform={at}>
          <path className="top" d="M0-24 24-12 0 0-24-12z" />
          <path className="left" d="M-24-12 0 0v26l-24-12z" />
          <path className="right" d="M24-12 0 0v26l24-12z" />
          <path className="edge" d="M0-24 24-12v26L0 26-24 14v-26zM0 0v26M-24-12 0 0l24-12" />
        </g>
      </svg>
    </span>
  );
}
