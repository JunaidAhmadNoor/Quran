// The home page for visitors: what Tilawah is, a few ayahs, and a way in.
import { Headphones, Mic, Play, ScrollText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { AyahMarker, GirihPattern, StarMark } from '@/components/ui/ornaments';
import { cn } from '@/lib/utils';

/** Heights of the decorative waveform bars, in percent. */
const BARS = [40, 65, 90, 55, 75, 100, 60, 85, 45, 70, 95, 50, 80, 60, 35, 70, 90, 55, 40, 65];

interface Props {
  stats: { surahs: number; ayahs: number };
  demo: { name: string; nameArabic: string; ayahs: { number: number; words: string[] }[] };
  verse: string;
}

export async function Landing({ stats, demo, verse }: Props) {
  const t = await getTranslations('home');
  const ts = await getTranslations('surah');
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale);
  const surahName = locale === 'en' ? demo.name : demo.nameArabic;
  const features = [
    {
      icon: Headphones,
      title: t('featureListenTitle'),
      body: t('featureListenBody'),
      href: '/surahs',
    },
    {
      icon: Mic,
      title: t('featureShareTitle'),
      body: t('featureShareBody'),
      href: '/auth/sign-up',
    },
    {
      icon: ScrollText,
      title: t('featureHadithTitle'),
      body: t('featureHadithBody'),
      href: '/hadith',
    },
  ];

  return (
    // The closing band meets the footer (cancels the page's bottom padding).
    <div className="-mb-16">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <GirihPattern className="opacity-[0.04]" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-24">
          <div className="animate-stagger">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted">
              <StarMark className="size-4 text-accent" />
              {t('eyebrow')}
            </p>
            <h1 className="mt-5 font-display text-4xl leading-[1.1] text-text sm:text-6xl">
              {t('landingTitle')}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t('landingBody')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">{t('createAccount')}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/surahs">{t('browse')}</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm">
              <Link
                href="/auth/sign-in"
                className="text-primary underline-offset-4 hover:underline"
              >
                {t('haveAccount')}
              </Link>
            </p>
          </div>
          <div className="animate-stagger [--i:3]">
            <div className="relative pb-10">
              <figure className="relative rounded-card border border-border bg-surface p-6 pb-16 shadow-sm sm:p-8 sm:pb-16">
                <figcaption className="flex items-center justify-between text-sm text-muted">
                  <span>{surahName}</span>
                  <span className="tabular-nums">
                    {nf.format(1)}:{nf.format(2)}–{nf.format(4)}
                  </span>
                </figcaption>
                <p lang="ar" dir="rtl" className="quran mt-4 text-text">
                  {demo.ayahs.map((a) => (
                    <span key={a.number}>
                      {a.words.join(' ')}{' '}
                      <AyahMarker n={a.number} label={ts('ayahMarker', { n: a.number })} />{' '}
                    </span>
                  ))}
                </p>
              </figure>
              {/* A picture of the player (decorative): listening is the heart of the site. */}
              <div
                aria-hidden
                className="absolute bottom-0 end-4 flex w-[min(20rem,85%)] items-center gap-3 rounded-card border border-border bg-surface-raised p-3 shadow-lg sm:end-8"
              >
                <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control bg-primary text-primary-contrast">
                  <StarMark className="absolute -end-3 -top-3 size-9 text-accent opacity-70" />
                  <span lang="ar" className="relative font-quran text-lg">
                    {demo.nameArabic}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{surahName}</span>
                  <span className="mt-1.5 flex h-5 items-center gap-[3px]">
                    {BARS.map((h, i) => (
                      <span
                        key={i}
                        className={cn('w-[3px] rounded-full', i < 11 ? 'bg-primary' : 'bg-border')}
                        style={{ height: `${String(h)}%` }}
                      />
                    ))}
                  </span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-contrast">
                  <Play className="size-4 fill-current" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="border-b border-border bg-surface">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 text-center sm:grid-cols-4">
          {[
            t('statSurahs', { n: nf.format(stats.surahs) }),
            t('statAyahs', { n: nf.format(stats.ayahs) }),
          ].map((fact) => (
            <li key={fact} className="py-5 font-display text-lg text-text">
              {fact}
            </li>
          ))}
          {/* Each name isolated, so the mixed scripts keep their order in any page direction. */}
          <li className="py-5 text-lg text-text">
            {['English', 'العربية', 'اردو'].map((name, i) => (
              <span key={name}>
                {i > 0 ? <span className="mx-2 text-muted">·</span> : null}
                <bdi>{name}</bdi>
              </span>
            ))}
          </li>
          <li className="flex items-center justify-center gap-2 py-5 text-sm text-muted">
            <ShieldCheck aria-hidden className="size-4 shrink-0 text-primary" />
            {t('statFree')}
          </li>
        </ul>
      </section>

      <div className="mx-auto max-w-6xl space-y-20 px-4 py-16">
        {/* Features */}
        <section aria-labelledby="features">
          <h2 id="features" className="font-display text-3xl text-text">
            {t('featuresTitle')}
          </h2>
          <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {features.map((f, i) => (
              <li
                key={f.title}
                className="animate-stagger"
                style={{ '--i': i } as React.CSSProperties}
              >
                <Link
                  href={f.href}
                  className="group flex h-full flex-col rounded-card border border-border bg-surface p-6 transition-colors hover:border-primary/50"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <f.icon aria-hidden className="size-5" />
                  </span>
                  <span className="mt-5 font-display text-xl text-text group-hover:underline">
                    {f.title}
                  </span>
                  <span className="mt-2 text-sm text-muted">{f.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Verse and final call */}
      <section className="relative overflow-hidden bg-primary text-primary-contrast">
        <GirihPattern className="text-primary-contrast opacity-[0.07]" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center">
          <p lang="ar" dir="rtl" className="quran text-primary-contrast">
            {verse}
          </p>
          <p className="mt-2 text-sm opacity-80">{t('verseRef')}</p>
          <h2 className="mt-10 font-display text-3xl">{t('finalTitle')}</h2>
          <p className="mx-auto mt-3 max-w-xl opacity-85">{t('finalBody')}</p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <Link href="/auth/sign-up">{t('createAccount')}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
