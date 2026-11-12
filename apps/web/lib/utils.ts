import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const arabicDigits = new Intl.NumberFormat('ar-u-nu-arab', { useGrouping: false });

/** Ayah numbers are shown in Arabic-Indic digits, as in a printed mushaf. */
export const mushafNumber = (n: number): string => arabicDigits.format(n);

export function formatBytes(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 });
  return mb >= 1024 ? `${fmt.format(mb / 1024)} GB` : `${fmt.format(mb)} MB`;
}

/** A text field from FormData ('' when missing or a file). */
export function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}
