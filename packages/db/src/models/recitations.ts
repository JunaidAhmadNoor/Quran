import { AudioContentType, RecitationStatus, RecitationStyle, Riwayah } from '@tilawah/contracts';
import { Schema, type Types } from 'mongoose';

export interface RecitationDoc {
  _id: Types.ObjectId;
  uploaderId: Types.ObjectId;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  title: string;
  riwayah: Riwayah;
  style: RecitationStyle;
  audioKey: string;
  audioContentType: AudioContentType;
  /** Set once the R2 object has been deleted (removed, or rejected past retention). */
  audioDeletedAt: Date | null;
  durationSec: number;
  sizeBytes: number;
  status: RecitationStatus;
  playCount: number;
  likeCount: number;
  rightsConfirmedAt: Date;
  moderationNote: string | null;
  moderatedBy: Types.ObjectId | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const recitationSchema = new Schema<RecitationDoc>(
  {
    uploaderId: { type: Schema.Types.ObjectId, required: true },
    surah: { type: Number, required: true, min: 1, max: 114 },
    ayahFrom: { type: Number, required: true, min: 1 },
    ayahTo: { type: Number, required: true, min: 1 },
    title: { type: String, required: true },
    riwayah: { type: String, enum: Riwayah.options, default: 'hafs' },
    style: { type: String, enum: RecitationStyle.options, required: true },
    audioKey: { type: String, required: true },
    audioContentType: { type: String, enum: AudioContentType.options, required: true },
    audioDeletedAt: { type: Date, default: null },
    durationSec: { type: Number, required: true },
    sizeBytes: { type: Number, required: true },
    status: { type: String, enum: RecitationStatus.options, required: true },
    playCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    rightsConfirmedAt: { type: Date, required: true },
    moderationNote: { type: String, default: null },
    moderatedBy: { type: Schema.Types.ObjectId, default: null },
    moderatedAt: { type: Date, default: null },
  },
  { collection: 'recitations', timestamps: true, versionKey: false },
);

recitationSchema.index({ status: 1, surah: 1, createdAt: -1, _id: -1 });
recitationSchema.index({ status: 1, surah: 1, playCount: -1, _id: -1 });
recitationSchema.index({ status: 1, playCount: -1, _id: -1 });
recitationSchema.index({ status: 1, createdAt: -1, _id: -1 });
recitationSchema.index({ uploaderId: 1, status: 1, createdAt: -1, _id: -1 });
recitationSchema.index({ audioKey: 1 }, { unique: true });
