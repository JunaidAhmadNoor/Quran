import { AyahMarker } from '@/components/ui/ornaments';

interface Props {
  bismillah: string | null;
  ayahs: { number: number; text: string }[];
  markerLabel: (n: number) => string;
}

/** The verified Tanzil text, ayah by ayah, each ending with a brass ayah marker. */
export function QuranText({ bismillah, ayahs, markerLabel }: Props) {
  return (
    <div
      lang="ar"
      dir="rtl"
      className="rounded-card border border-border bg-surface px-5 py-8 sm:px-10"
    >
      {bismillah ? <p className="quran mb-6 text-center text-text">{bismillah}</p> : null}
      <p className="quran text-justify text-text">
        {ayahs.map((a) => (
          <span key={a.number}>
            {a.text}
            <AyahMarker n={a.number} label={markerLabel(a.number)} />{' '}
          </span>
        ))}
      </p>
    </div>
  );
}
