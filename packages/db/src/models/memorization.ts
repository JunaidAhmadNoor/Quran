import { MemorizationMode, MistakeType } from '@tilawah/contracts';
import { Schema, type Types } from 'mongoose';

export const SESSION_RETENTION_SEC = 365 * 24 * 60 * 60;

export interface MemorizationSessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  mode: MemorizationMode;
  wordsTotal: number;
  wordsCorrect: number;
  mistakes: { ayah: number; word: number; type: MistakeType }[];
  startedAt: Date;
  endedAt: Date;
}

export const memorizationSessionSchema = new Schema<MemorizationSessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    surah: { type: Number, required: true },
    ayahFrom: { type: Number, required: true },
    ayahTo: { type: Number, required: true },
    mode: { type: String, enum: MemorizationMode.options, required: true },
    wordsTotal: { type: Number, required: true },
    wordsCorrect: { type: Number, required: true },
    mistakes: {
      type: [
        new Schema(
          {
            ayah: { type: Number, required: true },
            word: { type: Number, required: true },
            type: { type: String, enum: MistakeType.options, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
  },
  { collection: 'memorizationSessions', versionKey: false },
);
memorizationSessionSchema.index({ userId: 1, surah: 1 });
memorizationSessionSchema.index({ endedAt: 1 }, { expireAfterSeconds: SESSION_RETENTION_SEC });

export interface MemorizationProgressDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  surah: number;
  lastAyah: number;
  bestAccuracy: number;
  lastPracticedAt: Date;
}

export const memorizationProgressSchema = new Schema<MemorizationProgressDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    surah: { type: Number, required: true },
    lastAyah: { type: Number, required: true },
    bestAccuracy: { type: Number, required: true },
    lastPracticedAt: { type: Date, required: true },
  },
  { collection: 'memorizationProgress', versionKey: false },
);
memorizationProgressSchema.index({ userId: 1, surah: 1 }, { unique: true });
