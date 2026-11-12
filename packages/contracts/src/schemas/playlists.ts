import { z } from 'zod';
import {
  IsoDateTime,
  NON_EMPTY_PATCH_MESSAGE,
  ObjectId,
  PageQuery,
  nonEmptyPatch,
  paginated,
} from '../common';
import { MAX_NAME_LENGTH, MAX_PLAYLIST_ITEMS } from '../limits';
import { Recitation } from './recitations';

const PlaylistName = z.string().trim().min(1).max(MAX_NAME_LENGTH);

const RecitationIds = z
  .array(ObjectId)
  .max(MAX_PLAYLIST_ITEMS)
  .refine((ids) => new Set(ids).size === ids.length, 'recitationIds must not contain duplicates')
  .meta({ description: `Ordered list, at most ${MAX_PLAYLIST_ITEMS}. Replaces the whole list.` });

export const Playlist = z
  .object({
    id: ObjectId,
    name: z.string(),
    isPublic: z.boolean(),
    owner: z.object({ id: ObjectId, name: z.string() }),
    recitationCount: z.int().min(0),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .meta({ id: 'Playlist' });

export const PlaylistDetail = Playlist.extend({
  recitations: z.array(Recitation).meta({
    description: 'In playlist order. Recitations that are no longer approved are left out.',
  }),
}).meta({ id: 'PlaylistDetail' });

export const ListPlaylistsQuery = PageQuery;
export const PlaylistPage = paginated(Playlist).meta({ id: 'PlaylistPage' });

export const CreatePlaylistBody = z
  .object({
    name: PlaylistName,
    isPublic: z.boolean().default(false),
    recitationIds: RecitationIds.default([]),
  })
  .meta({ id: 'CreatePlaylistBody' });

export const UpdatePlaylistBody = z
  .object({ name: PlaylistName, isPublic: z.boolean(), recitationIds: RecitationIds })
  .partial()
  .refine(nonEmptyPatch, NON_EMPTY_PATCH_MESSAGE)
  .meta({ id: 'UpdatePlaylistBody' });
