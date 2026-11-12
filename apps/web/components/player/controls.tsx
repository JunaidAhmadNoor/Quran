'use client';
import { Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Slider } from '@/components/ui/slider';
import { SPEEDS, usePlayer } from '@/lib/player-store';
import { cn, formatDuration } from '@/lib/utils';
import { PlayPauseIcon } from './play-icon';

export function TransportControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const t = useTranslations('player');
  const tc = useTranslations('common');
  const playing = usePlayer((s) => s.playing);
  const { toggle, next, previous } = usePlayer.getState();
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-1 rtl:flex-row-reverse" dir="ltr">
      <Button
        variant="ghost"
        size={big ? 'icon' : 'icon-sm'}
        onClick={previous}
        aria-label={t('previous')}
      >
        <SkipBack />
      </Button>
      <Button
        size={big ? 'lg' : 'icon'}
        className={cn('rounded-full', big ? 'size-16 [&_svg]:size-6' : 'size-10')}
        onClick={toggle}
        aria-label={playing ? tc('pause') : tc('play')}
      >
        <PlayPauseIcon playing={playing} />
      </Button>
      <Button variant="ghost" size={big ? 'icon' : 'icon-sm'} onClick={next} aria-label={t('next')}>
        <SkipForward />
      </Button>
    </div>
  );
}

export function SeekBar({ className }: { className?: string }) {
  const t = useTranslations('player');
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  return (
    <div
      className={cn('flex items-center gap-3 text-xs tabular-nums text-muted', className)}
      dir="ltr"
    >
      <span className="w-10 text-end">{formatDuration(position)}</span>
      <Slider
        aria-label={t('seek')}
        value={[Math.min(position, duration || position)]}
        max={duration || 1}
        step={1}
        onValueChange={([v]) => {
          if (v !== undefined) usePlayer.getState().seek(v);
        }}
      />
      <span className="w-10">{formatDuration(duration)}</span>
    </div>
  );
}

export function SpeedMenu() {
  const t = useTranslations('player');
  const rate = usePlayer((s) => s.rate);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('speed')} className="tabular-nums">
          {rate}×
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuLabel>{t('speed')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(rate)}
          onValueChange={(v) => usePlayer.getState().setRate(Number(v))}
        >
          {SPEEDS.map((s) => (
            <DropdownMenuRadioItem key={s} value={String(s)}>
              {s}×
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RepeatButton() {
  const t = useTranslations('player');
  const repeat = usePlayer((s) => s.repeat);
  const label =
    repeat === 'one' ? t('repeatOne') : repeat === 'all' ? t('repeatAll') : t('repeatOff');
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => usePlayer.getState().cycleRepeat()}
      aria-label={label}
      title={label}
      aria-pressed={repeat !== 'off'}
      className={repeat === 'off' ? 'text-muted' : 'text-primary'}
    >
      {repeat === 'one' ? <Repeat1 /> : <Repeat />}
    </Button>
  );
}
