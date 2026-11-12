import { ReportReason, ReportStatus } from '@tilawah/contracts';
import { Schema, type Types } from 'mongoose';

export interface LikeDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  recitationId: Types.ObjectId;
  createdAt: Date;
}

export const likeSchema = new Schema<LikeDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    recitationId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: 'likes', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
likeSchema.index({ userId: 1, recitationId: 1 }, { unique: true });
likeSchema.index({ userId: 1, createdAt: -1, _id: -1 });

export interface PlaylistDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  recitationIds: Types.ObjectId[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const playlistSchema = new Schema<PlaylistDoc>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    recitationIds: { type: [Schema.Types.ObjectId], default: [] },
    isPublic: { type: Boolean, default: false },
  },
  { collection: 'playlists', timestamps: true, versionKey: false },
);
playlistSchema.index({ ownerId: 1, updatedAt: -1, _id: -1 });

export interface ReportDoc {
  _id: Types.ObjectId;
  recitationId: Types.ObjectId;
  reporterId: Types.ObjectId;
  reason: ReportReason;
  note: string | null;
  status: ReportStatus;
  resolution: { note: string | null; decidedAt: Date; decidedBy: Types.ObjectId } | null;
  createdAt: Date;
}

export const reportSchema = new Schema<ReportDoc>(
  {
    recitationId: { type: Schema.Types.ObjectId, required: true },
    reporterId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: ReportReason.options, required: true },
    note: { type: String, default: null },
    status: { type: String, enum: ReportStatus.options, default: 'open' },
    resolution: {
      type: new Schema(
        {
          note: { type: String, default: null },
          decidedAt: { type: Date, required: true },
          decidedBy: { type: Schema.Types.ObjectId, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { collection: 'reports', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
reportSchema.index({ status: 1, createdAt: 1, _id: 1 });
reportSchema.index({ recitationId: 1, status: 1 });
reportSchema.index(
  { recitationId: 1, reporterId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);
