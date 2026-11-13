'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

const SignIn = z.object({ email: z.email(), password: z.string().min(1) });
const SignUp = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8),
});

/** Only allow same-site redirects after sign-in. */
const safeNext = (next: string | null) =>
  next?.startsWith('/') && !next.startsWith('//') ? next : '/';

export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: 'sign-in' | 'sign-up';
  googleEnabled: boolean;
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  /** Sign-up done, verification email sent to this address. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Sign-in refused until this address is verified. */
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const isSignUp = mode === 'sign-up';
  const form = useForm<{ name?: string; email: string; password: string }>({
    resolver: zodResolver(isSignUp ? SignUp : SignIn),
    defaultValues: { name: '', email: '', password: '' },
  });
  const next = safeNext(params.get('next'));

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    setUnverified(null);
    setResent(false);
    const result = isSignUp
      ? await authClient.signUp.email({
          name: values.name ?? '',
          email: values.email,
          password: values.password,
          callbackURL: next, // where the verification link lands, signed in
        })
      : await authClient.signIn.email({ email: values.email, password: values.password });
    if (result.error?.code === 'EMAIL_NOT_VERIFIED') {
      setUnverified(values.email);
      return;
    }
    if (result.error) {
      setError(
        result.error.status === 422 || result.error.code === 'USER_ALREADY_EXISTS'
          ? t('exists')
          : result.error.status === 401
            ? t('invalid')
            : t('generic'),
      );
      return;
    }
    // Sign-up without a session: the account waits for its email to be verified.
    if (isSignUp && !result.data.token) {
      setSentTo(values.email);
      return;
    }
    qc.setQueryData(['me'], await api.getMe());
    router.push(next);
    router.refresh();
  });

  const resend = async () => {
    if (!unverified) return;
    const result = await authClient.sendVerificationEmail({ email: unverified, callbackURL: next });
    if (result.error) setError(t('generic'));
    else setResent(true);
  };

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 rounded-card border border-border bg-surface p-6">
        <h2 className="font-display text-xl text-text">{t('verifyTitle')}</h2>
        <p className="text-muted">{t('verifySent', { email: sentTo })}</p>
      </div>
    );
  }

  const errors = form.formState.errors;
  return (
    <div className="space-y-6">
      {googleEnabled ? (
        <>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: next })}
          >
            {t('google')}
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            {t('or')}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        {isSignUp ? (
          <Field id="name" label={t('name')} error={errors.name ? errors.name.message : undefined}>
            <Input
              id="name"
              autoComplete="name"
              {...form.register('name')}
              aria-invalid={Boolean(errors.name)}
            />
          </Field>
        ) : null}
        <Field
          id="email"
          label={t('email')}
          error={errors.email ? errors.email.message : undefined}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...form.register('email')}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>
        <Field
          id="password"
          label={t('password')}
          hint={isSignUp ? t('passwordHint') : undefined}
          error={errors.password ? errors.password.message : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            {...form.register('password')}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {unverified ? (
          <div
            role="alert"
            className="space-y-2 rounded-control border border-border bg-surface p-3 text-sm"
          >
            <p className="text-text">
              {resent ? t('resent', { email: unverified }) : t('notVerified')}
            </p>
            {!resent ? (
              <Button type="button" variant="link" onClick={() => void resend()}>
                {t('resend')}
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {isSignUp ? t('signUpTitle') : t('signInTitle')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        {isSignUp ? t('haveAccount') : t('noAccount')}{' '}
        <Link
          href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'}
          className="font-medium text-primary underline underline-offset-2"
        >
          {isSignUp ? t('signInTitle') : t('signUpTitle')}
        </Link>
      </p>
      {!isSignUp ? (
        <p className="text-center text-sm">
          <Link href="/auth/reset-password" className="text-primary underline underline-offset-2">
            {t('forgot')}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
