import { describe, expect, it } from 'vitest';
import { levenshtein, normalizeArabic, normalizeWords, similarity } from '../src';

describe('normalizeArabic', () => {
  it.each([
    // harakat, shadda, sukun, tanween
    ['harakat', 'بِسْمِ', 'بسم'],
    ['shadda + wasla', 'ٱللَّهِ', 'الله'],
    ['tatweel + dagger alef', 'ٱلرَّحْمَـٰنِ', 'الرحمن'],
    ['kasra + sukun', 'ٱلرَّحِيمِ', 'الرحيم'],
    ['damma', 'ٱلْحَمْدُ', 'الحمد'],
    ['tanween damm', 'أَحَدٌ', 'احد'],
    ['inna', 'إِنَّ', 'ان'],
    // alef forms
    ['alef hamza above', 'أَنعَمْتَ', 'انعمت'],
    ['alef hamza below', 'إِيَّاكَ', 'اياك'],
    ['alef madda', 'آمَنُوا', 'امنوا'],
    ['alef wasla', 'ٱهْدِنَا', 'اهدنا'],
    ['precomposed أ', 'أ', 'ا'],
    ['decomposed ا + hamza', 'أ', 'ا'],
    // teh marbuta and alef maksura
    ['ة → ه', 'رَحْمَةً', 'رحمه'],
    ['ه unchanged', 'رحمه', 'رحمه'],
    ['ى → ي with tanween', 'هُدًى', 'هدي'],
    ['ى with dagger alef', 'عَلَىٰ', 'علي'],
    ['Uthmani فِى', 'فِى', 'في'],
    ['Musa', 'مُوسَىٰ', 'موسي'],
    ['ad-Duha', 'وَٱلضُّحَىٰ', 'والضحي'],
    // Uthmani specifics
    ['dagger alef in kitab', 'ٱلْكِتَـٰبُ', 'الكتب'],
    ['small yeh', 'عِبَادَتِهِۦ', 'عبادته'],
    ['small waw', 'لَهُۥ', 'له'],
    ['salah with waw', 'ٱلصَّلَوٰةَ', 'الصلوه'],
    ['maliki', 'مَـٰلِكِ', 'ملك'],
    ['dalleen', 'ٱلضَّآلِّينَ', 'الضالين'],
    // hamza
    ['ؤ → و', 'يُؤْمِنُونَ', 'يومنون'],
    ['ئ → ي', 'ٱلسَّآئِلَ', 'السايل'],
    ['standalone hamza kept', 'شَىْءٍ', 'شيء'],
    ['jaa', 'جَآءَ', 'جاء'],
    // marks and signs disappear
    ['pause mark jeem', 'ۚ', ''],
    ['pause mark sali', 'ۖ', ''],
    ['rub el hizb', '۞', ''],
    ['sajdah', '۩', ''],
    ['tatweel only', 'ـــ', ''],
    ['word followed by pause mark', 'كِتَـٰبٌ ۚ', 'كتب'],
    // other scripts, punctuation, spacing
    ['Farsi yeh', 'یوم', 'يوم'],
    ['keheh', 'کتاب', 'كتاب'],
    ['punctuation splits words', 'الحمد،لله؟', 'الحمد لله'],
    ['whitespace collapses', '  الحمد   لله  ', 'الحمد لله'],
    ['digits removed', 'سورة ١١٢', 'سوره'],
    ['latin removed', 'hello الله', 'الله'],
  ])('%s', (_label, input, expected) => {
    expect(normalizeArabic(input)).toBe(expected);
  });

  it('makes Uthmani and plain spelling equal', () => {
    expect(normalizeArabic('ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ')).toBe(
      normalizeArabic('الحمد لله رب العلمين'),
    );
  });

  it('splits into words', () => {
    expect(normalizeWords('قُلْ هُوَ ٱللَّهُ أَحَدٌ')).toEqual(['قل', 'هو', 'الله', 'احد']);
    expect(normalizeWords('ۚ')).toEqual([]);
  });
});

describe('similarity', () => {
  it.each([
    ['', '', 0, 1],
    ['abc', '', 3, 0],
    ['الكتب', 'الكتاب', 1, 5 / 6],
    ['الرحمن', 'الرحمن', 0, 1],
    ['قل', 'هو', 2, 0],
  ])('%s vs %s', (a, b, distance, score) => {
    expect(levenshtein(a, b)).toBe(distance);
    expect(similarity(a, b)).toBeCloseTo(score);
  });
});
