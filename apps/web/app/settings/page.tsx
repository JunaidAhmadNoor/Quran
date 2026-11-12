import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SettingsForms } from '@/components/settings/settings-forms';
import { getMeOrNull } from '@/server/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('settings'))('title'), robots: { index: false } };
}

export default async function SettingsPage() {
  const me = await getMeOrNull();
  if (!me) redirect('/auth/sign-in?next=/settings');
  const t = await getTranslations('settings');
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 font-display text-4xl text-text">{t('title')}</h1>
      <SettingsForms me={me} />
    </div>
  );
}
