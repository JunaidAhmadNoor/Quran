'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';
import { formText } from '@/lib/utils';

/** Step 1: request a link. Step 2 (from the emailed link, ?token=…): set the new password. */
export function ResetForm() {
  const t = useTranslations('auth');
  const token = useSearchParams().get('token');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    if (token) {
      const password = formText(data, 'password');
      if (password.length < 8) {
        setError(t('passwordHint'));
        setBusy(false);
        return;
      }
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) setError(t('generic'));
      else setMessage(t('resetDone'));
    } else {
      await authClient.requestPasswordReset({
        email: formText(data, 'email'),
        redirectTo: '/auth/reset-password',
      });
      setMessage(t('resetSent')); // same message whether or not the account exists
    }
    setBusy(false);
  };

  if (message) {
    return (
      <div role="status" className="space-y-4">
        <p className="text-text">{message}</p>
        {token ? (
          <Button asChild>
            <Link href="/auth/sign-in">{t('signInTitle')}</Link>
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      {token ? (
        <Field id="password" label={t('newPassword')} hint={t('passwordHint')}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
      ) : (
        <Field id="email" label={t('email')}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {token ? t('setPassword') : t('resetSend')}
      </Button>
    </form>
  );
}
