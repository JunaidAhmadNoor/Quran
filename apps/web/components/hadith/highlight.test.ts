import { describe, expect, it } from 'vitest';
import { excerpt } from './highlight';

const marked = (pieces: ReturnType<typeof excerpt>) =>
  (pieces ?? []).filter((p) => p.mark).map((p) => p.text);

describe('excerpt', () => {
  it('marks English words in any case', () => {
    expect(
      marked(excerpt('The reward of deeds depends upon the Intentions.', ['intentions'])),
    ).toEqual(['Intentions']);
  });

  it('marks Arabic words in the original text, ignoring diacritics and alef forms', () => {
    const text = 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ';
    expect(marked(excerpt(text, ['انما', 'بالنيات']))).toEqual(['إِنَّمَا', 'بِالنِّيَّاتِ']);
  });

  it('cuts long texts around the first match', () => {
    const long = `${'word '.repeat(100)}target ${'word '.repeat(100)}`;
    const pieces = excerpt(long, ['target'], 30) ?? [];
    expect(pieces[0]?.text).toBe('… ');
    expect(pieces.at(-1)?.text).toBe(' …');
    expect(marked(pieces)).toEqual(['target']);
  });

  it('returns null when nothing matches', () => {
    expect(excerpt('nothing here', ['absent'])).toBeNull();
  });
});
