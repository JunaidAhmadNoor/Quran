import { AccountMode, Role } from '@tilawah/contracts';
import { Schema, type Types } from 'mongoose';

/**
 * Better Auth creates and owns user documents (collection `users`). This model reads them and
 * updates the fields Tilawah adds; the names must match the additionalFields in apps/web/server/auth.ts.
 */
export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: Role;
  mode: AccountMode;
  reciterSince: Date | null;
  verifiedReciter: boolean;
  bio: string | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, enum: Role.options, default: 'user' },
    mode: { type: String, enum: AccountMode.options, default: 'listener' },
    reciterSince: { type: Date, default: null },
    verifiedReciter: { type: Boolean, default: false },
    bio: { type: String, default: null },
    country: { type: String, default: null },
  },
  { collection: 'users', timestamps: true, versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index(
  { verifiedReciter: 1, _id: 1 },
  { partialFilterExpression: { verifiedReciter: true } },
);
