import { Schema, type Types } from 'mongoose';

/** Fixed-window counters and play de-duplication markers. _id is the full key. */
export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export const rateLimitSchema = new Schema<RateLimitDoc>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'rateLimits', versionKey: false },
);
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface PlayStatDailyDoc {
  _id: Types.ObjectId;
  recitationId: Types.ObjectId;
  /** UTC day, YYYY-MM-DD. */
  day: string;
  plays: number;
  expiresAt: Date;
}

export const playStatDailySchema = new Schema<PlayStatDailyDoc>(
  {
    recitationId: { type: Schema.Types.ObjectId, required: true },
    day: { type: String, required: true },
    plays: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'playStatsDaily', versionKey: false },
);
playStatDailySchema.index({ recitationId: 1, day: 1 }, { unique: true });
playStatDailySchema.index({ day: 1 });
playStatDailySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
