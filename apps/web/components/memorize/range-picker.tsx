'use client';
import { surahs } from '@tilawah/quran-data';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

export function RangePicker() {
  const t = useTranslations('memorize');
  const router = useRouter();
  const [surah, setSurah] = useState(112);
  const max = surahs[surah - 1]?.ayahCount ?? 1;
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(max);
  const valid = from >= 1 && from <= to && to <= max;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/memorize/${String(surah)}?from=${String(from)}&to=${String(to)}`);
      }}
    >
      <Field id="mem-surah" label={t('surah')}>
        <Select
          id="mem-surah"
          value={surah}
          onChange={(e) => {
            const n = Number(e.target.value);
            setSurah(n);
            setFrom(1);
            setTo(surahs[n - 1]?.ayahCount ?? 1);
          }}
        >
          {surahs.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.nameTransliterated} — {s.nameArabic}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="mem-from" label={t('from')}>
          <Input
            id="mem-from"
            type="number"
            min={1}
            max={max}
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
          />
        </Field>
        <Field id="mem-to" label={t('to')}>
          <Input
            id="mem-to"
            type="number"
            min={1}
            max={max}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            aria-invalid={!valid}
          />
        </Field>
      </div>
      <Button type="submit" disabled={!valid}>
        {t('start')}
      </Button>
    </form>
  );
}
