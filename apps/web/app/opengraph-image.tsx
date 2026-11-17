import { ImageResponse } from 'next/og';

export const alt = 'Tilawah: Quran recitations and hadith';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Link preview image: the brass star, the name and what the site is for. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1E4D45',
        color: '#F6F1E7',
      }}
    >
      <svg
        width="140"
        height="140"
        viewBox="0 0 48 48"
        fill="none"
        stroke="#D6B26A"
        strokeWidth="1.6"
      >
        <rect x="10" y="10" width="28" height="28" rx="1.5" />
        <rect x="10" y="10" width="28" height="28" rx="1.5" transform="rotate(45 24 24)" />
        <circle cx="24" cy="24" r="6.5" />
      </svg>
      <div style={{ marginTop: 36, fontSize: 96, letterSpacing: -2 }}>Tilawah</div>
      <div style={{ marginTop: 12, fontSize: 36, opacity: 0.85 }}>
        Listen to and share Quran recitations · Read hadith
      </div>
    </div>,
    size,
  );
}
