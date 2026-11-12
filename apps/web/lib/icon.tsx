import { ImageResponse } from 'next/og';

/** App icon: brass eight-point star on ink green. Drawn, so no font is needed. */
export function renderIcon(size: number): ImageResponse {
  const s = size;
  return new ImageResponse(
    <div
      style={{
        width: s,
        height: s,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1E4D45',
      }}
    >
      <svg
        width={s * 0.62}
        height={s * 0.62}
        viewBox="0 0 48 48"
        fill="none"
        stroke="#D6B26A"
        strokeWidth="2.4"
      >
        <rect x="10" y="10" width="28" height="28" rx="1.5" />
        <rect x="10" y="10" width="28" height="28" rx="1.5" transform="rotate(45 24 24)" />
        <circle cx="24" cy="24" r="6.5" />
      </svg>
    </div>,
    { width: s, height: s },
  );
}
