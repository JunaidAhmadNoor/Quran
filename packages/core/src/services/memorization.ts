import type { MemorizationProgressDoc } from '@tilawah/db';
import { isValidAyahRange, loadSurahText } from '@tilawah/quran-data';
import { requireActor, type Actor } from '../actor';
import type { C, Out, ServiceDeps } from '../context';
import { DomainError, invalid } from '../errors';

const toProgress = (p: MemorizationProgressDoc): Out<typeof C.MemorizationProgress> => ({
  surah: p.surah,
  lastAyah: p.lastAyah,
  bestAccuracy: p.bestAccuracy,
  lastPracticedAt: p.lastPracticedAt.toISOString(),
});

export class MemorizationService {
  constructor(private readonly deps: ServiceDeps) {}

  async saveSession(actor: Actor | null, body: Out<typeof C.CreateMemorizationSessionBody>) {
    const me = requireActor(actor);
    if (!isValidAyahRange(body.surah, body.ayahFrom, body.ayahTo)) {
      throw new DomainError(
        'INVALID_AYAH_RANGE',
        `Surah ${body.surah} has no ayahs ${body.ayahFrom}–${body.ayahTo}`,
      );
    }
    // Checked against the real text so progress cannot be inflated.
    const text = await loadSurahText(body.surah);
    const ayahs = text.ayahs.slice(body.ayahFrom - 1, body.ayahTo);
    const wordCount = ayahs.reduce((n, a) => n + a.words.length, 0);
    if (body.wordsTotal !== wordCount) {
      throw invalid(`wordsTotal must be ${wordCount} for this range`, ['wordsTotal']);
    }
    for (const m of body.mistakes) {
      const words = text.ayahs[m.ayah - 1]?.words.length ?? 0;
      if (m.word > words) throw invalid(`Ayah ${m.ayah} has only ${words} words`, ['mistakes']);
    }

    const accuracy = body.wordsCorrect / body.wordsTotal;
    const { id, progress } = await this.deps.repos.memorization.saveSession(
      {
        userId: me.userId,
        surah: body.surah,
        ayahFrom: body.ayahFrom,
        ayahTo: body.ayahTo,
        mode: body.mode,
        wordsTotal: body.wordsTotal,
        wordsCorrect: body.wordsCorrect,
        mistakes: body.mistakes,
        startedAt: new Date(body.startedAt),
        endedAt: new Date(body.endedAt),
      },
      accuracy,
    );
    return { id, accuracy, progress: toProgress(progress) };
  }

  async progress(actor: Actor | null): Promise<Out<typeof C.MemorizationProgressResponse>> {
    const me = requireActor(actor);
    const items = await this.deps.repos.memorization.listProgress(me.userId);
    return { items: items.map(toProgress) };
  }
}
