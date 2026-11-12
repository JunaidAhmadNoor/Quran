import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ModeSwitch } from '@/components/layout/mode-switch';
import { UploadForm } from '@/components/upload/upload-form';
import { Card } from '@/components/ui/misc';
import { StarMark } from '@/components/ui/ornaments';
import { getServerContext } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('upload'))('title'), robots: { index: false } };
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string }>;
}) {
  const { actor } = await getServerContext();
  if (!actor) redirect('/auth/sign-in?next=/upload');
  const t = await getTranslations('upload');
  const surah = Number((await searchParams).surah);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 font-display text-4xl text-text">{t('title')}</h1>
      {actor.reciterSince ? (
        <UploadForm
          initialSurah={Number.isInteger(surah) && surah >= 1 && surah <= 114 ? surah : undefined}
        />
      ) : (
        <Card className="p-8 text-center">
          <StarMark className="mx-auto mb-4 size-10 text-accent" />
          <h2 className="font-display text-2xl text-text">{t('needReciterTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">{t('needReciterBody')}</p>
          <ModeSwitch className="mt-6" redirect={false} />
        </Card>
      )}
    </div>
  );
}
