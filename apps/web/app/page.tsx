import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Dashboard } from '@/components/home/dashboard';
import { Landing } from '@/components/home/landing';
import { getMeOrNull, getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('home');
  return { title: { absolute: t('metaTitle') }, description: t('landingBody') };
}

/** Visitors get the landing page; signed-in users get their own home (progress first). */
export default async function HomePage() {
  const { core, actor } = await getServerContext();
  const me = await getMeOrNull();
  const surahs = core.surahs.list().items;

  if (!me) {
    const [fatiha, muzzammil, trending, newest] = await Promise.all([
      core.surahs.text(1),
      core.surahs.text(73),
      core.recitations.list(null, { sort: 'trending', limit: 6 }),
      core.recitations.list(null, { sort: 'newest', limit: 6 }),
    ]);
    const demoAyahs = fatiha.ayahs
      .slice(1, 4)
      .map((a) => ({ number: a.number, words: a.words.map((w) => w.text) }));
    const listen =
      trending.items.length > 0
        ? { page: trending, sort: 'trending' as const }
        : newest.items.length > 0
          ? { page: newest, sort: 'newest' as const }
          : null;
    return (
      <Landing
        stats={{ surahs: surahs.length, ayahs: surahs.reduce((n, s) => n + s.ayahCount, 0) }}
        demo={{ title: `${surahs[0]?.nameTransliterated ?? ''} · 1:2–4`, ayahs: demoAyahs }}
        verse={muzzammil.ayahs[3]?.text ?? ''}
        listen={listen}
      />
    );
  }

  const [progress, stats, trending, newest, reciters] = await Promise.all([
    core.memorization.progress(actor),
    me.mode === 'reciter' ? core.account.reciterStats(actor) : Promise.resolve(null),
    core.recitations.list(actor, { sort: 'trending', limit: 6 }),
    core.recitations.list(actor, { sort: 'newest', limit: 6 }),
    core.reciters.listVerified({ limit: 8 }),
  ]);
  return (
    <Dashboard
      me={me}
      surahs={surahs}
      progress={progress.items}
      stats={stats}
      trending={trending}
      newest={newest}
      reciters={reciters.items}
    />
  );
}
