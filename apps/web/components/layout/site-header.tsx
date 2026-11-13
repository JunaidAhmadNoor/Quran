'use client';
import {
  BookOpen,
  Library,
  LogOut,
  Menu,
  Mic,
  Settings,
  Shield,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { StarMark } from '@/components/ui/ornaments';
import { isStaffRole, useMe } from '@/hooks/use-me';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { ModeSwitch } from './mode-switch';
import { LanguageMenu, ThemeMenu } from './preferences';

function useNav() {
  const t = useTranslations('nav');
  const { data: me } = useMe();
  // Visitors only see the landing page and sign-in; everything else needs an account.
  if (!me) return [];
  // Moderators and admins see their work only; listener pages are not for staff accounts.
  if (isStaffRole(me)) {
    const staff = [{ href: '/moderation', label: t('moderation') }];
    if (me.role === 'admin') staff.push({ href: '/admin/users', label: t('users') });
    return staff;
  }
  const items = [
    { href: '/', label: t('home') },
    { href: '/surahs', label: t('surahs') },
    { href: '/memorize', label: t('memorize') },
    { href: '/hadith', label: t('hadith') },
    { href: '/library', label: t('library') },
  ];
  if (me.mode === 'reciter') items.splice(1, 0, { href: '/studio', label: t('studio') });
  return items;
}

export function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const nav = useNav();
  const staff = isStaffRole(me);
  // The menu remembers the page it was opened on, so navigating closes it without an effect.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
  const menuOpen = menuOpenAt === pathname;
  const setMenuOpen = (open: boolean) => setMenuOpenAt(open ? pathname : null);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const signOut = async () => {
    await authClient.signOut();
    qc.setQueryData(['me'], null);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href={staff ? '/moderation' : '/'}
          className="flex items-center gap-2 text-text"
          aria-label={tc('appName')}
        >
          <StarMark className="size-7 text-accent" />
          <span className="font-display text-xl">{tc('appName')}</span>
        </Link>
        <nav aria-label={t('primary')} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-control px-3 py-2 text-sm text-muted transition-colors duration-150 hover:text-text',
                    isActive(item.href) && 'font-medium text-text',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-1">
          {!staff ? <ModeSwitch className="hidden sm:inline-flex" /> : null}
          {!staff && me?.mode === 'reciter' ? (
            <Button asChild size="sm" className="ms-1 hidden sm:inline-flex">
              <Link href="/upload">
                <Upload />
                {t('upload')}
              </Link>
            </Button>
          ) : null}
          <LanguageMenu />
          <ThemeMenu />
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('account')}
                  className="ms-1 rounded-full border border-border"
                >
                  <span className="text-xs font-semibold">{me.name.slice(0, 1).toUpperCase()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{me.name}</DropdownMenuLabel>
                {!staff ? (
                  <DropdownMenuItem asChild>
                    <Link href="/library">
                      <Library />
                      {t('library')}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {!staff && me.reciterSince ? (
                  <DropdownMenuItem asChild>
                    <Link href="/studio">
                      <Mic />
                      {t('studio')}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {staff ? (
                  <DropdownMenuItem asChild>
                    <Link href="/moderation">
                      <Shield />
                      {t('moderation')}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {me.role === 'admin' ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/users">
                      <Users />
                      {t('users')}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    {t('settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut />
                  {t('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="ms-1">
                <Link href="/auth/sign-in">{t('signIn')}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/sign-up">{t('signUp')}</Link>
              </Button>
            </>
          )}
          {nav.length > 0 ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label={t('menu')}
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </Button>
          ) : null}
        </div>
      </div>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent title={t('menu')} closeLabel={tc('close')} className="top-4 translate-y-0">
          <nav aria-label={t('primary')}>
            <ul className="space-y-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className="flex items-center gap-3 rounded-control px-3 py-3 text-text hover:bg-surface-raised aria-[current=page]:font-medium aria-[current=page]:text-primary"
                  >
                    <BookOpen className="size-4 text-muted" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {me && !staff ? <ModeSwitch className="mt-4 w-full [&>button]:flex-1" /> : null}
        </DialogContent>
      </Dialog>
    </header>
  );
}
